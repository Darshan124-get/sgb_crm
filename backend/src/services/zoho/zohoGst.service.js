const axios = require('axios');
const zohoAuth = require('./zohoAuth.service');

class ZohoGstService {
    constructor() {
        this.taxesCache = null;
        this.cacheExpiresAt = 0;
        this.CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
        this.homeState = 'KA'; // Karnataka is the home state of SGB Agro

        // Fallback default tax mappings for quick resolution
        this.defaultIntraStateTaxes = {
            0: { id: '3580403000000032424', name: 'GST0', rate: 0 },
            5: { id: '3580403000000032428', name: 'GST5', rate: 5 },
            12: { id: '3580403000000032432', name: 'GST12', rate: 12 },
            18: { id: '3580403000000032436', name: 'GST18', rate: 18 },
            28: { id: '3580403000000032444', name: 'GST28', rate: 28 },
            40: { id: '3580403000000032440', name: 'GST40', rate: 40 }
        };

        this.defaultInterStateTaxes = {
            0: { id: '3580403000000032352', name: 'IGST0', rate: 0 },
            5: { id: '3580403000000032354', name: 'IGST5', rate: 5 },
            12: { id: '3580403000000032356', name: 'IGST12', rate: 12 },
            18: { id: '3580403000000032360', name: 'IGST18', rate: 18 },
            28: { id: '3580403000000032362', name: 'IGST28', rate: 28 },
            40: { id: '3580403000000032358', name: 'IGST40', rate: 40 }
        };
    }

    /**
     * Normalize state to standard 2-letter uppercase GST code
     */
    normalizeStateCode(input) {
        if (!input) return 'KA';
        let str = String(input).trim();
        // Check if starts with [XX] or contains [XX]
        const bracketMatch = str.match(/\[([A-Za-z]{2})\]/);
        if (bracketMatch) {
            return bracketMatch[1].toUpperCase();
        }

        // Common map of State Names to 2-letter codes
        const stateMap = {
            'KARNATAKA': 'KA',
            'MAHARASHTRA': 'MH',
            'KERALA': 'KL',
            'KERALAM': 'KL',
            'TAMIL NADU': 'TN',
            'ANDHRA PRADESH': 'AP',
            'TELANGANA': 'TS',
            'GOA': 'GA',
            'GUJARAT': 'GJ',
            'MADHYA PRADESH': 'MP',
            'HARYANA': 'HR',
            'PUNJAB': 'PB',
            'RAJASTHAN': 'RJ',
            'UTTAR PRADESH': 'UP',
            'DELHI': 'DL',
            'WEST BENGAL': 'WB',
            'ODISHA': 'OD',
            'ORISSA': 'OD',
            'BIHAR': 'BR',
            'JHARKHAND': 'JH',
            'ASSAM': 'AS',
            'HIMACHAL PRADESH': 'HP',
            'JAMMU AND KASHMIR': 'JK',
            'UTTARAKHAND': 'UK',
            'CHATTISGARH': 'CG',
            'CHHATTISGARH': 'CG'
        };

        const cleanName = str.toUpperCase().replace(/[^A-Z]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanName.length === 2) return cleanName;
        if (stateMap[cleanName]) return stateMap[cleanName];

        for (const [sName, sCode] of Object.entries(stateMap)) {
            if (cleanName.includes(sName)) return sCode;
        }

        return str.length === 2 ? str.toUpperCase() : 'KA';
    }

    /**
     * Fetch taxes and tax groups from Zoho Books
     */
    async getGstConfig(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.taxesCache && now < this.cacheExpiresAt) {
            return this.taxesCache;
        }

        try {
            const orgId = process.env.ZOHO_ORGANIZATION_ID;
            if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is missing');

            const headers = await zohoAuth.getAuthHeaders();
            const res = await axios.get(`${zohoAuth.apiDomain}/settings/taxes?organization_id=${orgId}`, { headers });

            const taxes = res.data?.taxes || [];
            const taxGroups = res.data?.tax_groups || [];

            // Group into intra-state tax groups (CGST+SGST) and inter-state (IGST)
            const intraMap = { ...this.defaultIntraStateTaxes };
            const interMap = { ...this.defaultInterStateTaxes };

            // Look through tax groups for intra-state (GST0, GST5, GST12, GST18, GST28)
            taxGroups.forEach(tg => {
                const pct = Math.round(tg.tax_percentage || 0);
                intraMap[pct] = {
                    id: tg.tax_group_id,
                    name: tg.tax_group_name,
                    rate: tg.tax_percentage,
                    is_group: true
                };
            });

            // Look through taxes for IGST (inter-state)
            taxes.forEach(t => {
                const name = (t.tax_name || '').toUpperCase();
                const pct = Math.round(t.tax_percentage || 0);
                if (name.startsWith('IGST')) {
                    interMap[pct] = {
                        id: t.tax_id,
                        name: t.tax_name,
                        rate: t.tax_percentage,
                        is_group: false
                    };
                }
            });

            this.taxesCache = {
                home_state: this.homeState,
                intra_state_taxes: intraMap,
                inter_state_taxes: interMap,
                all_taxes: taxes,
                all_tax_groups: taxGroups
            };
            this.cacheExpiresAt = now + this.CACHE_TTL_MS;

            return this.taxesCache;
        } catch (err) {
            console.warn('[ZOHO GST] Failed to fetch live taxes from Zoho, using default mappings:', err.message);
            return {
                home_state: this.homeState,
                intra_state_taxes: this.defaultIntraStateTaxes,
                inter_state_taxes: this.defaultInterStateTaxes,
                all_taxes: [],
                all_tax_groups: []
            };
        }
    }

    /**
     * Resolve the exact tax ID and tax object based on rate and place of supply
     * @param {number|string} rate 
     * @param {string} placeOfSupply 
     * @param {string} gstTreatment 
     */
    async resolveApplicableTax(rate = 5, placeOfSupply = 'KA', gstTreatment = 'consumer') {
        const config = await this.getGstConfig();
        const normState = this.normalizeStateCode(placeOfSupply);
        const numRate = Math.round(parseFloat(rate) || 0);

        // Check intra vs inter
        const isIntraState = (normState === config.home_state);

        if (isIntraState) {
            const match = config.intra_state_taxes[numRate] || this.defaultIntraStateTaxes[numRate] || this.defaultIntraStateTaxes[5];
            return {
                is_intra_state: true,
                state_code: normState,
                tax_id: match.id,
                tax_name: match.name,
                tax_rate: match.rate,
                tax_type: 'tax_group'
            };
        } else {
            const match = config.inter_state_taxes[numRate] || this.defaultInterStateTaxes[numRate] || this.defaultInterStateTaxes[5];
            return {
                is_intra_state: false,
                state_code: normState,
                tax_id: match.id,
                tax_name: match.name,
                tax_rate: match.rate,
                tax_type: 'tax'
            };
        }
    }
}

module.exports = new ZohoGstService();

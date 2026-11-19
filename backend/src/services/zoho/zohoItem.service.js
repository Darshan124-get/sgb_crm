const axios = require('axios');
const zohoAuth = require('./zohoAuth.service');
const pool = require('../../config/db');

class ZohoItemService {
    /**
     * Fetch all active items from Zoho Books (paginated)
     */
    async fetchZohoItems() {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is missing');

        const headers = await zohoAuth.getAuthHeaders();
        let page = 1;
        let hasMore = true;
        const allItems = [];

        while (hasMore && page <= 10) { // Safety cap of 10 pages (2000 items)
            const res = await axios.get(
                `${zohoAuth.apiDomain}/items?organization_id=${orgId}&page=${page}&per_page=200`,
                { headers }
            );

            const items = res.data?.items || [];
            allItems.push(...items);

            hasMore = res.data?.page_context?.has_more_page || false;
            page++;
        }

        return allItems;
    }

    /**
     * Normalize string for fuzzy matching (remove dashes, spaces, casing)
     */
    cleanStr(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Sync Zoho Items catalogue into local products table
     */
    async syncCatalogueWithZoho() {
        console.log('[ZOHO ITEMS] Starting catalogue sync...');
        const zohoItems = await this.fetchZohoItems();
        console.log(`[ZOHO ITEMS] Retrieved ${zohoItems.length} items from Zoho Books.`);

        const [localProducts] = await pool.query('SELECT product_id, name, sku, hsn_code, zoho_item_id, gst_rate FROM products');
        
        let updatedCount = 0;
        let matchedCount = 0;

        for (const p of localProducts) {
            const pCleanName = this.cleanStr(p.name);
            const pCleanSku = this.cleanStr(p.sku);

            // Match against zohoItems
            const match = zohoItems.find(z => {
                if (p.zoho_item_id && p.zoho_item_id === z.item_id) return true;
                const zCleanName = this.cleanStr(z.name);
                const zCleanSku = this.cleanStr(z.sku);

                if (zCleanSku && pCleanSku && (zCleanSku === pCleanSku || pCleanSku.includes(zCleanSku) || zCleanSku.includes(pCleanSku))) {
                    return true;
                }
                if (zCleanName && pCleanName && (zCleanName === pCleanName || zCleanName.includes(pCleanName) || pCleanName.includes(zCleanName))) {
                    return true;
                }
                return false;
            });

            if (match) {
                matchedCount++;
                const zItemId = match.item_id;
                const hsn = match.hsn_or_sac || '';
                const taxPct = parseFloat(match.tax_percentage) || 5;

                const needsUpdate = 
                    p.zoho_item_id !== zItemId ||
                    (!p.hsn_code && hsn) ||
                    (p.gst_rate !== taxPct);

                if (needsUpdate) {
                    await pool.query(
                        `UPDATE products 
                         SET zoho_item_id = ?, 
                             hsn_code = COALESCE(NULLIF(hsn_code, ''), ?), 
                             gst_rate = ?
                         WHERE product_id = ?`,
                        [zItemId, hsn, taxPct, p.product_id]
                    );
                    updatedCount++;
                    console.log(`[ZOHO ITEMS] Linked Product "${p.name}" (ID ${p.product_id}) -> Zoho Item "${match.name}" (${zItemId})`);
                }
            }
        }

        console.log(`[ZOHO ITEMS] Sync complete. Matched: ${matchedCount}, Updated: ${updatedCount}`);
        return {
            total_zoho_items: zohoItems.length,
            matched: matchedCount,
            updated: updatedCount
        };
    }
}

module.exports = new ZohoItemService();

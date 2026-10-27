const axios = require('axios');
const pool = require('../../config/db');

class ZohoAuthService {
    constructor() {
        this.accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
        this.apiDomain = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.in/books/v3';
        this.clientId = process.env.ZOHO_CLIENT_ID || '';
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
        this.redirectUri = process.env.ZOHO_REDIRECT_URI || '';
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
        this.organizationId = process.env.ZOHO_ORGANIZATION_ID || '';

        // In-memory token cache
        this.cachedAccessToken = null;
        this.tokenExpiresAt = null;
    }

    /**
     * Generate the Zoho OAuth Authorization URL
     */
    getAuthorizationUrl(state = 'sgb_zoho_auth') {
        const scopes = [
            'ZohoBooks.salesorders.ALL',
            'ZohoBooks.invoices.ALL',
            'ZohoBooks.customerpayments.ALL',
            'ZohoBooks.contacts.ALL',
            'ZohoBooks.settings.READ',
            'ZohoBooks.reports.READ'
        ].join(',');

        const redirectUri = encodeURIComponent(this.redirectUri || 'http://localhost:5000/api/integrations/zoho/callback');
        return `${this.accountsUrl}/oauth/v2/auth?scope=${scopes}&client_id=${this.clientId}&response_type=code&access_type=offline&redirect_uri=${redirectUri}&prompt=consent&state=${state}`;
    }

    /**
     * Exchange Authorization Code for Access & Refresh Tokens
     */
    async exchangeCodeForToken(code, redirectUri = null) {
        const uri = redirectUri || this.redirectUri || 'http://localhost:5000/api/integrations/zoho/callback';
        const params = new URLSearchParams({
            code,
            client_id: this.clientId || process.env.ZOHO_CLIENT_ID,
            client_secret: this.clientSecret || process.env.ZOHO_CLIENT_SECRET,
            redirect_uri: uri,
            grant_type: 'authorization_code'
        });

        const response = await axios.post(`${this.accountsUrl}/oauth/v2/token`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.error) {
            throw new Error(`Zoho Token Exchange Error: ${response.data.error}`);
        }

        const { access_token, refresh_token, expires_in, api_domain } = response.data;

        // Cache in memory
        this.cachedAccessToken = access_token;
        this.tokenExpiresAt = Date.now() + ((expires_in || 3600) - 300) * 1000; // 5 min safety buffer

        if (refresh_token) {
            this.refreshToken = refresh_token;
        }

        return response.data;
    }

    /**
     * Get a valid Access Token (auto-refreshes using Refresh Token if expired)
     */
    async getAccessToken() {
        const now = Date.now();
        if (this.cachedAccessToken && this.tokenExpiresAt && this.tokenExpiresAt > now) {
            return this.cachedAccessToken;
        }

        const refreshToken = this.refreshToken || process.env.ZOHO_REFRESH_TOKEN;
        const clientId = this.clientId || process.env.ZOHO_CLIENT_ID;
        const clientSecret = this.clientSecret || process.env.ZOHO_CLIENT_SECRET;

        if (!refreshToken || !clientId || !clientSecret) {
            throw new Error('Zoho credentials missing: ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, or ZOHO_CLIENT_SECRET');
        }

        const params = new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token'
        });

        const response = await axios.post(`${this.accountsUrl}/oauth/v2/token`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.error) {
            throw new Error(`Zoho Token Refresh Error: ${response.data.error}`);
        }

        const { access_token, expires_in } = response.data;
        this.cachedAccessToken = access_token;
        this.tokenExpiresAt = Date.now() + ((expires_in || 3600) - 300) * 1000;

        return access_token;
    }

    /**
     * Get authorized headers for Zoho Books API calls
     */
    async getAuthHeaders() {
        const token = await this.getAccessToken();
        const orgId = this.organizationId || process.env.ZOHO_ORGANIZATION_ID;

        return {
            Authorization: `Zoho-oauthtoken ${token}`,
            'X-com-zoho-books-organizationid': orgId,
            'Content-Type': 'application/json;charset=UTF-8'
        };
    }
}

module.exports = new ZohoAuthService();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const code = process.argv[2];

if (!code) {
    console.error('\n❌ Usage: node scripts/exchange_zoho_token.js <GENERATED_GRANT_CODE>\n');
    process.exit(1);
}

const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('❌ ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET missing in backend/.env');
    process.exit(1);
}

async function exchangeToken() {
    try {
        console.log(`\n🔄 Exchanging grant code with ${accountsUrl}/oauth/v2/token ...`);
        
        const params = new URLSearchParams({
            code: code.trim(),
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            grant_type: 'authorization_code'
        });

        const response = await axios.post(`${accountsUrl}/oauth/v2/token`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.error) {
            console.error('\n❌ Zoho Error:', response.data.error);
            process.exit(1);
        }

        const { refresh_token, access_token, api_domain, expires_in } = response.data;

        console.log('\n✅ Token exchange successful!');
        console.log('--------------------------------------------------');
        console.log(`🔑 Refresh Token: ${refresh_token || '(Not returned - already generated before or invalid scope)'}`);
        console.log(`⚡ Access Token:  ${access_token ? access_token.substring(0, 15) + '...' : 'none'} (Expires in ${expires_in}s)`);
        console.log(`🌐 API Domain:    ${api_domain}`);
        console.log('--------------------------------------------------\n');

        if (refresh_token) {
            // Update backend/.env automatically
            const envPath = path.join(__dirname, '../.env');
            let envContent = fs.readFileSync(envPath, 'utf8');

            if (envContent.includes('ZOHO_REFRESH_TOKEN=')) {
                envContent = envContent.replace(/ZOHO_REFRESH_TOKEN=.*/, `ZOHO_REFRESH_TOKEN=${refresh_token}`);
            } else {
                envContent += `\nZOHO_REFRESH_TOKEN=${refresh_token}\n`;
            }

            fs.writeFileSync(envPath, envContent, 'utf8');
            console.log('💾 Automatically updated ZOHO_REFRESH_TOKEN in backend/.env!');
        }

    } catch (err) {
        console.error('❌ Request Failed:', err.response?.data || err.message);
    }
}

exchangeToken();

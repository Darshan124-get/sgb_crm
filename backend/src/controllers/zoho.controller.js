const zohoAuth = require('../services/zoho/zohoAuth.service');
const pool = require('../config/db');

/**
 * Handle Zoho OAuth Redirect Callback
 * Route: GET /api/integrations/zoho/callback
 */
const handleOAuthCallback = async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            console.error(`[ZOHO OAUTH ERROR] ${error}: ${error_description}`);
            return res.status(400).send(`
                <html>
                <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #ef4444; max-width: 500px; text-align: center;">
                        <h2 style="color: #ef4444; margin-top: 0;">❌ Zoho Authorization Failed</h2>
                        <p style="color: #cbd5e1;"><strong>Error:</strong> ${error}</p>
                        <p style="color: #94a3b8; font-size: 0.9rem;">${error_description || 'The authorization request was rejected or expired.'}</p>
                        <a href="/modules/billing/billing.html" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to CRM</a>
                    </div>
                </body>
                </html>
            `);
        }

        if (!code) {
            return res.status(400).send(`
                <html>
                <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; text-align: center;">
                        <h2 style="color: #f59e0b; margin-top: 0;">⚠️ No Authorization Code Received</h2>
                        <p style="color: #94a3b8;">Expected '?code=...' parameter in callback request.</p>
                    </div>
                </body>
                </html>
            `);
        }

        console.log(`[ZOHO OAUTH] Received authorization code: ${code.substring(0, 10)}...`);

        let exchangeResult = null;
        let exchangeError = null;

        // Attempt automatic code exchange if Client ID and Secret are configured
        if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) {
            try {
                // Determine the redirect URI that was matched
                const protocol = req.protocol;
                const host = req.get('host');
                const dynamicRedirectUri = `${protocol}://${host}${req.baseUrl}/callback`;

                exchangeResult = await zohoAuth.exchangeCodeForToken(code, dynamicRedirectUri);
                console.log(`[ZOHO OAUTH] Successfully obtained refresh token!`);
            } catch (err) {
                console.warn(`[ZOHO OAUTH] Auto-exchange note: ${err.message}`);
                exchangeError = err.message;
            }
        }

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Zoho Books Authorization - SGB CRM</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
                    .card { background: #161e2e; border: 1px solid #2d3748; border-radius: 16px; padding: 32px; max-width: 650px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
                    .badge { background: #059669; color: #ecfdf5; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; }
                    h2 { margin: 0; color: #ffffff; font-size: 22px; }
                    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 8px 0; }
                    .code-block { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; margin: 15px 0; }
                    .info-box { background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #cbd5e1; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h2>✅ Zoho Books Authorization Successful</h2>
                        <span class="badge">Connected</span>
                    </div>
                    <p>SGB CRM received the authorization grant code from Zoho Accounts India.</p>

                    <div style="margin-top: 16px;">
                        <label style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Authorization Grant Code:</label>
                        <div class="code-block">${code}</div>
                    </div>

                    ${exchangeResult && exchangeResult.refresh_token ? `
                        <div class="info-box" style="border-left-color: #10b981; background: rgba(16, 185, 129, 0.1);">
                            <strong style="color: #10b981;">Permanent Refresh Token Obtained:</strong><br>
                            <span style="font-family: monospace; font-size: 12px; color: #e2e8f0;">${exchangeResult.refresh_token}</span>
                        </div>
                    ` : `
                        <div class="info-box">
                            <strong>Next Step:</strong> Save your <code>ZOHO_CLIENT_ID</code> and <code>ZOHO_CLIENT_SECRET</code> in <code>backend/.env</code> to automatically finalize the refresh token lifecycle.
                        </div>
                    `}

                    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This window can safely be closed.</p>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[ZOHO CALLBACK ERROR]', err);
        res.status(500).json({ error: 'Internal server error processing Zoho callback', details: err.message });
    }
};

/**
 * Handle Incoming Zoho Books Webhooks
 * Route: POST /api/integrations/zoho/webhook
 */
const handleWebhook = async (req, res) => {
    try {
        const payload = req.body;
        console.log('[ZOHO WEBHOOK RECEIVED]', JSON.stringify(payload).substring(0, 300));

        // Insert webhook payload into logs for auditing and billing analysis
        try {
            await pool.query(
                `INSERT INTO invoice_logs (action, new_value, changed_by) 
                 VALUES (?, ?, ?)`,
                ['ZOHO_WEBHOOK_EVENT', JSON.stringify(payload).substring(0, 1000), 1]
            );
        } catch (dbErr) {
            // Silently continue if table format varies
        }

        // Return immediate 200 OK so Zoho recognizes webhook delivery
        res.status(200).json({
            status: 'success',
            message: 'Zoho Books webhook received and logged'
        });
    } catch (err) {
        console.error('[ZOHO WEBHOOK ERROR]', err);
        res.status(500).json({ error: 'Failed to process Zoho Books webhook' });
    }
};

/**
 * Get Current Zoho Integration Status & Health Check
 * Route: GET /api/integrations/zoho/status
 */
const getStatus = async (req, res) => {
    try {
        const hasClientId = !!process.env.ZOHO_CLIENT_ID;
        const hasClientSecret = !!process.env.ZOHO_CLIENT_SECRET;
        const hasRefreshToken = !!process.env.ZOHO_REFRESH_TOKEN;
        const hasOrgId = !!process.env.ZOHO_ORGANIZATION_ID;

        res.json({
            success: true,
            status: 'operational',
            region: 'India (.in)',
            configuration: {
                has_client_id: hasClientId,
                has_client_secret: hasClientSecret,
                has_refresh_token: hasRefreshToken,
                has_organization_id: hasOrgId,
                ready_for_sync: hasClientId && hasClientSecret && hasRefreshToken && hasOrgId
            },
            endpoints: {
                callback_url_dev: 'http://localhost:5000/api/integrations/zoho/callback',
                callback_url_prod: `${process.env.APP_BASE_URL || ''}/api/integrations/zoho/callback`,
                webhook_url: `${process.env.APP_BASE_URL || ''}/api/integrations/zoho/webhook`
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get OAuth Authorization URL
 * Route: GET /api/integrations/zoho/auth-url
 */
const getAuthUrl = async (req, res) => {
    try {
        const url = zohoAuth.getAuthorizationUrl();
        res.json({ success: true, authorization_url: url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    handleOAuthCallback,
    handleWebhook,
    getStatus,
    getAuthUrl
};

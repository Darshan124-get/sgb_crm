const TelephonyService = require('../services/telephony.service');

class TelephonyController {
    static async getIntegration(req, res) {
        try {
            const data = await TelephonyService.getIntegration();
            return res.json({ success: true, integration: data });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async saveCredentials(req, res) {
        try {
            const { api_token, environment } = req.body;
            if (!api_token) return res.status(400).json({ success: false, error: 'API token is required' });

            const adminUserId = req.user ? req.user.user_id : null;
            const result = await TelephonyService.saveCredentials({ apiToken: api_token, environment, adminUserId });
            return res.json({ success: true, message: 'API credentials saved successfully', masked_token: result.masked_token });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async testConnection(req, res) {
        try {
            const userId = req.user ? req.user.user_id : null;
            const result = await TelephonyService.testConnection(userId);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getCrmUsers(req, res) {
        try {
            const users = await TelephonyService.getCrmUsers();
            return res.json({ success: true, users });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getAcefoneAgents(req, res) {
        try {
            const result = await TelephonyService.getAcefoneAgents();
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getAgents(req, res) {
        try {
            const agents = await TelephonyService.getAgents();
            return res.json({ success: true, agents });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async deleteAgent(req, res) {
        try {
            const { id } = req.params;
            const result = await TelephonyService.deleteAgent(id);
            return res.json({ success: true, message: 'Agent deleted successfully' });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async mapAgent(req, res) {
        try {
            const { id, crm_user_id, acefone_user_id, acefone_agent_id, agent_name, agent_phone, extension, calling_channel, default_outbound_did_id, did_ids } = req.body;
            if (!crm_user_id || !agent_name) {
                return res.status(400).json({ success: false, error: 'CRM user ID and Agent name are required' });
            }
            if (!agent_phone) {
                return res.status(400).json({ success: false, error: 'Agent mobile number is required' });
            }

            const adminUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const result = await TelephonyService.mapAgent({
                id,
                crmUserId: crm_user_id,
                acefoneUserId: acefone_user_id,
                acefoneAgentId: acefone_agent_id,
                agentName: agent_name,
                agentPhone: agent_phone,
                extension,
                callingChannel: calling_channel,
                defaultOutboundDidId: default_outbound_did_id,
                didIds: did_ids,
                adminUserId
            });

            return res.json({ success: true, message: 'Agent mapped successfully', data: result });
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }

    static async getDids(req, res) {
        try {
            const dids = await TelephonyService.getDids();
            return res.json({ success: true, dids });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async syncDids(req, res) {
        try {
            const dids = await TelephonyService.syncDidsFromAcefone();
            return res.json({ success: true, message: 'DIDs synced from Acefone successfully', dids });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async saveDid(req, res) {
        try {
            const { id, did_number, display_name, crm_user_id, destination_name, status, notes } = req.body;
            if (!did_number && !id) {
                return res.status(400).json({ success: false, error: 'DID Number is required' });
            }
            const result = await TelephonyService.saveDid({ id, did_number, display_name, crm_user_id, destination_name, status, notes });
            return res.json({ success: true, message: 'DID saved successfully' });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async deleteDid(req, res) {
        try {
            const { id } = req.params;
            const result = await TelephonyService.deleteDid(id);
            return res.json({ success: true, message: 'DID deleted successfully' });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async initiateClickToCall(req, res) {
        try {
            const { lead_id, destination_phone, crm_user_id } = req.body;
            const authenticatedUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const targetCrmUserId = crm_user_id || authenticatedUserId;

            if (!targetCrmUserId) {
                return res.status(401).json({ success: false, error: 'Unauthorized: User session not found. Please log in again.' });
            }

            const result = await TelephonyService.initiateClickToCall({
                crmUserId: targetCrmUserId,
                leadId: lead_id,
                destinationPhone: destination_phone
            });

            return res.json(result);
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }

    static async getCallStatus(req, res) {
        try {
            const { callId } = req.params;
            const authenticatedUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const data = await TelephonyService.getCallStatus(callId, authenticatedUserId);
            return res.json(data);
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }

    static async handleWebhook(req, res) {
        try {
            const result = await TelephonyService.processWebhook({
                headers: req.headers,
                payload: req.body,
                endpoint: req.originalUrl
            });
            return res.status(result.status || 200).json(result);
        } catch (err) {
            console.error("[WEBHOOK CONTROLLER ERROR]", err.message);
            return res.status(200).json({ status: 200, message: 'Webhook received' }); // Always HTTP 200 to Acefone
        }
    }

    static async getCallLogs(req, res) {
        try {
            const { page, limit, search, status, direction, telecaller, lead_id } = req.query;
            const authenticatedUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
            const isSupervisor = userRole === 'admin' || userRole === 'super-admin';

            const targetUserId = isSupervisor ? null : authenticatedUserId;
            const targetTelecaller = isSupervisor ? telecaller : null;

            const data = await TelephonyService.getCallLogs({
                page,
                limit,
                search,
                status,
                direction,
                telecaller: targetTelecaller,
                crmUserId: targetUserId,
                lead_id
            });
            return res.json({ success: true, ...data });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async syncCdr(req, res) {
        try {
            const { page, limit, from_date, to_date, auto_offload } = req.body || {};
            const result = await TelephonyService.syncCdrFromAcefone({
                page: page || 1,
                limit: limit || 50,
                fromDate: from_date,
                toDate: to_date,
                autoOffloadAudio: auto_offload !== false
            });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getRecentCalls(req, res) {
        try {
            const { limit, search, telecaller_id } = req.query;
            const authenticatedUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
            const isSupervisor = userRole === 'admin' || userRole === 'super-admin';

            // Only admin and super-admin have access to view all organization calls.
            // If admin passes telecaller_id, filter by that telecaller; otherwise null = full org.
            // Regular telecallers / agents are strictly locked to their own authenticated user ID.
            const targetUserId = isSupervisor
                ? (telecaller_id ? parseInt(telecaller_id, 10) : null)
                : authenticatedUserId;

            const calls = await TelephonyService.getRecentCalls({
                crmUserId: targetUserId,
                limit: limit ? parseInt(limit, 10) : 50,
                search: search || ''
            });
            return res.json({ success: true, calls });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getCallDetails(req, res) {
        try {
            const { callId } = req.params;
            const call = await TelephonyService.getCallDetails(callId);
            if (!call) return res.status(404).json({ success: false, error: 'Call record not found' });
            return res.json({ success: true, call });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async getPerformance(req, res) {
        try {
            const data = await TelephonyService.getPerformanceMetrics();
            return res.json({ success: true, performance: data });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    static async hangupCall(req, res) {
        try {
            const { callId } = req.params;
            const authenticatedUserId = req.user ? (req.user.user_id || req.user.id) : null;
            const result = await TelephonyService.hangupCall(callId, authenticatedUserId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }
}

module.exports = TelephonyController;

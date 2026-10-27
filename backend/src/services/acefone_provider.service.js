const axios = require('axios');
const pool = require('../config/db');

/**
 * Service handling direct API communications with Acefone Cloud API.
 * Sanitizes all Authorization headers before persisting outbound API logs.
 */
class AcefoneProviderService {
    /**
     * Sanitizes sensitive fields from headers/payloads for logging
     */
    static sanitizeForLogging(data) {
        if (!data) return data;
        const copy = JSON.parse(JSON.stringify(data));
        if (copy.Authorization) copy.Authorization = 'Bearer [MASKED]';
        if (copy.authorization) copy.authorization = 'Bearer [MASKED]';
        if (copy.api_token) copy.api_token = '[MASKED]';
        if (copy.token) copy.token = '[MASKED]';
        return copy;
    }

    /**
     * Helper to write outbound API audit logs into telephony_api_logs
     */
    static async logApiCall({ integrationId, userId, apiName, method, endpoint, requestId, requestPayload, status, responseBody, durationMs, success, errorCode, errorMessage }) {
        try {
            const sanitizedReq = this.sanitizeForLogging(requestPayload);
            const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || {});

            await pool.query(`
                INSERT INTO telephony_api_logs (
                    integration_id, crm_user_id, api_name, http_method, endpoint,
                    request_id, request_payload, response_status, response_body,
                    duration_ms, success, error_code, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                integrationId, userId || null, apiName, method, endpoint,
                requestId || null, JSON.stringify(sanitizedReq || {}), status, bodyStr,
                durationMs, success, errorCode || null, errorMessage || null
            ]);
        } catch (err) {
            console.error("[ACEFONE API LOG ERROR]", err.message);
        }
    }

    /**
     * Test connection to Acefone API using provided token.
     * Uses resilient multi-endpoint fallback:
     * 1. Try GET /v1/users (Full Admin scope)
     * 2. If 403 (Permission Denied), try POST /v1/click_to_call (Click-to-Call scope)
     */
    static async testConnection(baseUrl, apiToken, integrationId, userId) {
        const startTime = Date.now();
        const base = baseUrl.replace(/\/$/, '');

        // Primary test: GET /v1/users
        try {
            const response = await axios.get(`${base}/v1/users`, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'SGB-Agro-CRM/1.0'
                },
                timeout: 10000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, userId, apiName: 'test_connection', method: 'GET', endpoint: '/v1/users',
                requestPayload: { baseUrl }, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            return { success: true, message: 'Connection successful (User Management Scope)', data: response.data };
        } catch (err) {
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            // If status is 403 (Permission Denied on /v1/users), test /v1/click_to_call scope!
            if (status === 403) {
                try {
                    const c2cResponse = await axios.post(`${base}/v1/click_to_call`, {
                        agent_number: 'test_verify',
                        destination_number: 'test_verify'
                    }, {
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'User-Agent': 'SGB-Agro-CRM/1.0'
                        },
                        timeout: 10000
                    });

                    const durationMs = Date.now() - startTime;
                    await this.logApiCall({
                        integrationId, userId, apiName: 'test_connection', method: 'POST', endpoint: '/v1/click_to_call',
                        requestPayload: { baseUrl }, status: c2cResponse.status, responseBody: c2cResponse.data,
                        durationMs, success: true
                    });

                    return { success: true, message: 'Connection successful (Click to Call Scope)', data: c2cResponse.data };
                } catch (c2cErr) {
                    const c2cStatus = c2cErr.response ? c2cErr.response.status : 500;
                    const c2cBody = c2cErr.response ? c2cErr.response.data : c2cErr.message;
                    const durationMs = Date.now() - startTime;

                    // If HTTP status is 400 or 422 (Validation Error on test payload), authentication PASSED!
                    if (c2cStatus === 400 || c2cStatus === 422 || c2cStatus === 200) {
                        await this.logApiCall({
                            integrationId, userId, apiName: 'test_connection', method: 'POST', endpoint: '/v1/click_to_call',
                            requestPayload: { baseUrl }, status: c2cStatus, responseBody: c2cBody,
                            durationMs, success: true
                        });
                        return { success: true, message: 'Connection successful (Acefone API Token Validated)', data: c2cBody };
                    }

                    // Otherwise if 401 or 403, log failure
                    await this.logApiCall({
                        integrationId, userId, apiName: 'test_connection', method: 'POST', endpoint: '/v1/click_to_call',
                        requestPayload: { baseUrl }, status: c2cStatus, responseBody: c2cBody,
                        durationMs, success: false, errorCode: c2cErr.code || 'CONN_ERR', errorMessage: c2cErr.message
                    });

                    const msg = typeof c2cBody === 'object' && c2cBody.message ? c2cBody.message : `Acefone API returned status ${c2cStatus}`;
                    return { success: false, message: msg, error: c2cBody };
                }
            }

            // Standard failure (e.g. 401 Invalid Token or network error)
            const durationMs = Date.now() - startTime;
            await this.logApiCall({
                integrationId, userId, apiName: 'test_connection', method: 'GET', endpoint: '/v1/users',
                requestPayload: { baseUrl }, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'CONN_ERR', errorMessage: err.message
            });

            const errMsg = typeof body === 'object' && body.message ? body.message : (err.message || 'Invalid API Token or Permission Denied');
            return { success: false, message: errMsg, error: body };
        }
    }

    /**
     * Extract clean error message from Acefone API response or error payload
     */
    static extractErrorMessage(body, fallbackMsg = 'Click-to-Call failed at Acefone provider') {
        if (!body) return fallbackMsg;
        if (typeof body === 'string') {
            try {
                const parsed = JSON.parse(body);
                return this.extractErrorMessage(parsed, body.length < 300 ? body : fallbackMsg);
            } catch (e) {
                return body.length < 300 ? body : fallbackMsg;
            }
        }
        if (typeof body === 'object') {
            if (body.message && typeof body.message === 'string') return body.message;
            if (body.error) {
                if (typeof body.error === 'string') return body.error;
                if (typeof body.error === 'object') {
                    if (body.error.message) return body.error.message;
                    if (body.error.description) return body.error.description;
                }
            }
            if (body.description && typeof body.description === 'string') return body.description;
            if (body.msg && typeof body.msg === 'string') return body.msg;
            if (body.reason && typeof body.reason === 'string') return body.reason;
            if (body.errors) {
                if (typeof body.errors === 'string') return body.errors;
                if (typeof body.errors === 'object') {
                    const vals = Object.values(body.errors).flat();
                    if (vals.length > 0) return String(vals[0]);
                }
            }
        }
        return fallbackMsg;
    }

    /**
     * Initiate Click to Call outbound request
     */
    static async initiateClickToCall({ baseUrl, apiToken, integrationId, userId, agentNumber, destinationNumber, callerId, timeout, customIdentifier }) {
        const startTime = Date.now();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/click_to_call`;

        const requestPayload = {
            agent_number: agentNumber,
            destination_number: destinationNumber,
            caller_id: callerId,
            call_timeout: timeout || 3600,
            async: true,
            custom_identifier: customIdentifier
        };

        try {
            const response = await axios.post(endpoint, requestPayload, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 12000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, userId, apiName: 'click_to_call', method: 'POST', endpoint: '/v1/click_to_call',
                requestPayload, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            const resData = response.data || {};

            // Acefone can return HTTP 200 with error/fail indicator in payload
            const isBodySuccess = !(
                resData.status === false ||
                resData.status === 0 ||
                resData.status === 'false' ||
                resData.status === 'error' ||
                resData.status === 'fail' ||
                resData.status === 'failed' ||
                resData.success === false ||
                resData.success === 'false' ||
                (resData.code && String(resData.code) !== '200')
            );

            if (!isBodySuccess || (resData.error && !resData.ref_id && !resData.id && !resData.call_id)) {
                const errMsg = this.extractErrorMessage(resData, 'Acefone rejected the Click-to-Call request.');
                return {
                    success: false,
                    message: `Acefone Call Rejected: ${errMsg}`,
                    error: resData
                };
            }

            const acefoneRefId = resData.ref_id || resData.id || resData.call_id || `ace_ref_${Date.now()}`;

            return {
                success: true,
                acefone_ref_id: acefoneRefId,
                raw_response: resData
            };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, userId, apiName: 'click_to_call', method: 'POST', endpoint: '/v1/click_to_call',
                requestPayload, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'C2C_ERR', errorMessage: err.message
            });

            const extractedMsg = this.extractErrorMessage(body, err.message || 'Failed to initiate Click to Call');

            return {
                success: false,
                message: `Acefone Call Error: ${extractedMsg}`,
                error: body
            };
        }
    }

    /**
     * Fetch list of Agents/Users from Acefone API (/v1/users)
     */
    static async fetchAgents(baseUrl, apiToken, integrationId) {
        const startTime = Date.now();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/users`;

        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json'
                },
                timeout: 15000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, apiName: 'fetch_agents', method: 'GET', endpoint: '/v1/users',
                requestPayload: {}, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            const rawData = response.data;
            const userArray = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.data) ? rawData.data : []);

            return { success: true, agents: userArray, raw: rawData };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, apiName: 'fetch_agents', method: 'GET', endpoint: '/v1/users',
                requestPayload: {}, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'FETCH_AGENTS_ERR', errorMessage: err.message
            });

            return { success: false, message: err.message, agents: [], error: body };
        }
    }

    /**
     * Fetch list of Virtual DIDs / My Numbers from Acefone API (/v1/my_number)
     */
    static async fetchDids(baseUrl, apiToken, integrationId) {
        const startTime = Date.now();
        const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/my_number`;

        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json'
                },
                timeout: 15000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, apiName: 'fetch_dids', method: 'GET', endpoint: '/v1/my_number',
                requestPayload: {}, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            const rawData = response.data;
            const didArray = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.data) ? rawData.data : []);

            return { success: true, dids: didArray, raw: rawData };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, apiName: 'fetch_dids', method: 'GET', endpoint: '/v1/my_number',
                requestPayload: {}, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'FETCH_DIDS_ERR', errorMessage: err.message
            });

            return { success: false, message: err.message, dids: [], error: body };
        }
    }

    /**
     * Fetch active live calls from Acefone API (/v1/live_calls)
     */
    static async fetchLiveCalls(baseUrl, apiToken, integrationId) {
        const startTime = Date.now();
        const base = (baseUrl || 'https://api.acefone.in').replace(/\/$/, '');
        const endpoint = `${base}/v1/live_calls`;

        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, apiName: 'fetch_live_calls', method: 'GET', endpoint: '/v1/live_calls',
                requestPayload: {}, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            const liveCalls = Array.isArray(response.data) ? response.data : [];
            return { success: true, live_calls: liveCalls };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, apiName: 'fetch_live_calls', method: 'GET', endpoint: '/v1/live_calls',
                requestPayload: {}, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'FETCH_LIVE_CALLS_ERR', errorMessage: err.message
            });

            return { success: false, live_calls: [], error: body };
        }
    }

    /**
     * Terminate / Hang up an active call on Acefone Cloud API (/v1/call/hangup)
     */
    static async hangupCall({ baseUrl, apiToken, integrationId, userId, callId, refId, customerPhone, agentPhone }) {
        const startTime = Date.now();
        const base = (baseUrl || 'https://api.acefone.in').replace(/\/$/, '');
        const endpoint = `${base}/v1/call/hangup`;

        let targetCallId = (callId && String(callId).startsWith('SRVINF')) ? callId : null;
        const cleanCust = customerPhone ? String(customerPhone).replace(/\D/g, '').slice(-10) : '';
        const cleanAgent = agentPhone ? String(agentPhone).replace(/\D/g, '').slice(-10) : '';

        // If targetCallId is missing, perform a resilient retry poll (up to 10 attempts with 400ms delay) to discover Acefone's call_id
        if (!targetCallId && apiToken) {
            for (let attempt = 1; attempt <= 10; attempt++) {
                try {
                    const liveRes = await this.fetchLiveCalls(base, apiToken, integrationId);
                    if (liveRes.success && Array.isArray(liveRes.live_calls) && liveRes.live_calls.length > 0) {
                        const matched = liveRes.live_calls.find(c => {
                            if (refId && (c.ref_id === refId || c.id === refId || c.uuid === refId)) return true;
                            if (callId && (c.call_id === callId || c.id === callId)) return true;
                            
                            const cCust = String(c.customer_number || c.destination || c.destination_number || c.to || c.customer || c.phone || '').replace(/\D/g, '').slice(-10);
                            const cAgent = String(c.source || c.from || c.agent_number || c.agent || c.user_number || c.src || '').replace(/\D/g, '').slice(-10);

                            if (cleanCust && cCust && cCust === cleanCust) return true;
                            if (cleanAgent && cAgent && cAgent === cleanAgent) return true;
                            return false;
                        });

                        if (matched && (matched.call_id || matched.id)) {
                            targetCallId = String(matched.call_id || matched.id);
                            console.log(`🎯 Acefone Live Call Discovered on attempt ${attempt}: ${targetCallId}`);
                            // Store discovered call_id back into DB if refId is available
                            if (refId) {
                                pool.query(`UPDATE telephony_calls SET acefone_call_id = ? WHERE acefone_ref_id = ? AND acefone_call_id IS NULL`, [targetCallId, refId]).catch(e => {});
                            }
                            break;
                        }
                    }
                } catch (findErr) {
                    console.warn(`[HANGUP MATCH RETRY ${attempt}]`, findErr.message);
                }
                // Pause 400ms before next attempt to allow Acefone PBX channel creation
                if (attempt < 10) await new Promise(r => setTimeout(r, 400));
            }
        }

        // Acefone POST /v1/call/hangup accepts STRICTLY single identifier: call_id OR ref_id
        const requestPayload = {};
        if (targetCallId) {
            requestPayload.call_id = targetCallId;
        } else if (refId) {
            requestPayload.ref_id = refId;
        }

        try {
            const response = await axios.post(endpoint, requestPayload, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, userId, apiName: 'hangup_call', method: 'POST', endpoint: '/v1/call/hangup',
                requestPayload, status: response.status, responseBody: response.data,
                durationMs, success: true
            });

            return { success: true, data: response.data, target_call_id: targetCallId };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, userId, apiName: 'hangup_call', method: 'POST', endpoint: '/v1/call/hangup',
                requestPayload, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'HANGUP_ERR', errorMessage: err.message
            });

            const msg = this.extractErrorMessage(body, 'Failed to hang up active call');
            return { success: false, message: msg, error: body };
        }
    }

    /**
     * Fetch CDR (Call Detail Records) from Acefone API (/v1/call/records)
     */
    static async fetchCdrRecords({ baseUrl, apiToken, integrationId, fromDate, toDate, page = 1, limit = 50, callType, direction, callerId, destination }) {
        const startTime = Date.now();
        const base = (baseUrl || 'https://api.acefone.in').replace(/\/$/, '');
        const endpoint = `${base}/v1/call/records`;

        const params = {
            page: String(page),
            limit: String(limit)
        };
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        if (callType) params.call_type = callType; // 'c' = answered, 'm' = missed
        if (direction) params.direction = direction; // 'inbound' or 'outbound'
        if (callerId) params.callerid = callerId;
        if (destination) params.destination = destination;

        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json'
                },
                params,
                timeout: 25000
            });
            const durationMs = Date.now() - startTime;

            await this.logApiCall({
                integrationId, apiName: 'fetch_cdr_records', method: 'GET', endpoint: '/v1/call/records',
                requestPayload: params, status: response.status, responseBody: { count: response.data?.count, size: response.data?.size },
                durationMs, success: true
            });

            const resData = response.data || {};
            const records = Array.isArray(resData.results) ? resData.results : (Array.isArray(resData) ? resData : []);
            return {
                success: true,
                count: resData.count || records.length,
                page: resData.page || page,
                limit: resData.limit || limit,
                records
            };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const status = err.response ? err.response.status : 500;
            const body = err.response ? err.response.data : err.message;

            await this.logApiCall({
                integrationId, apiName: 'fetch_cdr_records', method: 'GET', endpoint: '/v1/call/records',
                requestPayload: params, status, responseBody: body,
                durationMs, success: false, errorCode: err.code || 'FETCH_CDR_ERR', errorMessage: err.message
            });

            return {
                success: false,
                message: this.extractErrorMessage(body, 'Failed to fetch CDR records from Acefone'),
                records: [],
                count: 0
            };
        }
    }
}

module.exports = AcefoneProviderService;

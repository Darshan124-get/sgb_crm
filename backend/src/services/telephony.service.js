const crypto = require('crypto');
const pool = require('../config/db');
const cryptoService = require('./telephony_crypto.service');
const AcefoneProviderService = require('./acefone_provider.service');
const storageService = require('./storage.service');
const axios = require('axios');

class TelephonyService {
    /**
     * Get active telephony integration & connection state
     */
    static async getIntegration() {
        const [rows] = await pool.query(`
            SELECT i.*, c.credential_last_four, c.is_active as credential_active, s.default_call_timeout, s.default_calling_channel, s.recording_enabled
            FROM telephony_integrations i
            LEFT JOIN telephony_credentials c ON c.integration_id = i.id AND c.is_active = TRUE
            LEFT JOIN telephony_call_settings s ON s.integration_id = i.id
            WHERE i.provider = 'acefone' LIMIT 1
        `);
        if (rows.length === 0) return null;
        
        const integration = rows[0];
        integration.masked_token = integration.credential_last_four ? cryptoService.getMaskedToken(integration.credential_last_four) : 'Not Configured';
        delete integration.encrypted_value;
        return integration;
    }

    /**
     * Save/Update API credentials (Encrypted AES-256)
     */
    static async saveCredentials({ apiToken, environment, adminUserId }) {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Telephony integration not found");

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { encrypted_value, credential_last_four } = cryptoService.encryptToken(apiToken);

            // Deactivate old credentials
            await connection.query(`UPDATE telephony_credentials SET is_active = FALSE WHERE integration_id = ?`, [integration.id]);

            // Insert new encrypted credential
            await connection.query(`
                INSERT INTO telephony_credentials (integration_id, credential_type, credential_name, encrypted_value, credential_last_four, is_active, created_by)
                VALUES (?, 'api_token', 'Acefone Production Token', ?, ?, TRUE, ?)
            `, [integration.id, encrypted_value, credential_last_four, adminUserId || null]);

            // Update environment on integration
            await connection.query(`UPDATE telephony_integrations SET environment = ?, updated_at = NOW() WHERE id = ?`, [environment || 'production', integration.id]);

            // Audit log
            await connection.query(`
                INSERT INTO telephony_audit_logs (integration_id, admin_user_id, sync_source, entity_type, entity_id, action, new_values)
                VALUES (?, ?, 'admin', 'credential', ?, 'UPDATE_CREDENTIAL', ?)
            `, [integration.id, adminUserId || null, String(integration.id), JSON.stringify({ environment, credential_last_four })]);

            await connection.commit();

            // Perform async connection test
            this.testConnection(adminUserId).catch(err => console.error("Post-save connection test warn:", err.message));

            return { success: true, masked_token: cryptoService.getMaskedToken(credential_last_four) };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Get active raw API Token (Decrypted internally)
     */
    static async getDecryptedToken(integrationId) {
        const [rows] = await pool.query(`
            SELECT encrypted_value FROM telephony_credentials
            WHERE integration_id = ? AND is_active = TRUE LIMIT 1
        `, [integrationId]);
        if (rows.length === 0) return null;
        return cryptoService.decryptToken(rows[0].encrypted_value);
    }

    /**
     * Test connection to Acefone
     */
    static async testConnection(userId) {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Telephony integration not found");

        const token = await this.getDecryptedToken(integration.id);
        if (!token) throw new Error("No active API token configured");

        const result = await AcefoneProviderService.testConnection(integration.base_url, token, integration.id, userId);

        const now = new Date();
        const healthStatus = result.success ? 'healthy' : 'failed';
        const updateSql = result.success 
            ? `UPDATE telephony_integrations SET health_status = 'healthy', last_connection_test_at = ?, last_connection_success_at = ? WHERE id = ?`
            : `UPDATE telephony_integrations SET health_status = 'failed', last_connection_test_at = ? WHERE id = ?`;
        
        const params = result.success ? [now, now, integration.id] : [now, integration.id];
        await pool.query(updateSql, params);

        return result;
    }

    /**
     * Get list of CRM Users for Telephony Mapping dropdown
     */
    static async getCrmUsers() {
        const [rows] = await pool.query(`
            SELECT u.user_id, u.name, u.email, u.phone, COALESCE(r.name, 'Telecaller') as role
            FROM users u
            LEFT JOIN roles r ON r.role_id = u.role_id
            WHERE u.status = 'active' OR u.status IS NULL
            ORDER BY u.name ASC
        `);
        return rows;
    }

    /**
     * Get Acefone extension agents (fetches live from Acefone API /v1/users with fallback)
     */
    static async getAcefoneAgents() {
        try {
            const integration = await this.getIntegration();
            if (integration) {
                const apiToken = await this.getDecryptedToken(integration.id);
                if (apiToken) {
                    const res = await AcefoneProviderService.fetchAgents(integration.base_url || 'https://api.acefone.in', apiToken, integration.id);
                    if (res.success && Array.isArray(res.agents) && res.agents.length > 0) {
                        return {
                            success: true,
                            source: 'acefone_api',
                            agents: res.agents.map(a => ({
                                acefone_agent_id: String(a.id || a.user_id || a.extension || a.ext_id),
                                agent_name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.username || `Agent ${a.extension}`,
                                extension: String(a.extension || a.ext || a.user_id || ''),
                                agent_phone: a.mobile || a.phone || a.phone_number || ''
                            }))
                        };
                    }
                }
            }
        } catch (err) {
            console.warn("[ACEFONE AGENTS FETCH NOTICE]", err.message);
        }

        // Return mapped database agents
        const [mapped] = await pool.query(`
            SELECT DISTINCT acefone_agent_id, agent_name, extension, agent_phone
            FROM telephony_agents
            ORDER BY agent_name ASC
        `);

        return {
            success: true,
            source: mapped.length > 0 ? 'database' : 'acefone_portal',
            agents: mapped
        };
    }

    /**
     * Get list of agents mapped with CRM users along with assigned DIDs
     */
    static async getAgents() {
        const [agents] = await pool.query(`
            SELECT a.*, u.name as crm_user_name, u.email as crm_user_email, u.phone as crm_user_phone,
                   d.did_number as default_did_number, d.display_name as default_did_name
            FROM telephony_agents a
            JOIN users u ON u.user_id = a.crm_user_id
            LEFT JOIN telephony_dids d ON d.id = a.default_outbound_did_id
            ORDER BY a.agent_name ASC
        `);

        for (const agent of agents) {
            const [dids] = await pool.query(`
                SELECT d.id, d.did_number, d.display_name, ad.can_outbound, ad.can_inbound
                FROM telephony_agent_dids ad
                JOIN telephony_dids d ON d.id = ad.did_id
                WHERE ad.telephony_agent_id = ? AND ad.is_active = TRUE
            `, [agent.id]);
            agent.assigned_dids = dids;
        }

        return agents;
    }

    /**
     * Delete an agent mapping
     */
    static async deleteAgent(agentId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // 1. Delete associated DID mapping entries for this agent
            await connection.query(`DELETE FROM telephony_agent_dids WHERE telephony_agent_id = ?`, [agentId]);
            // 2. Set telephony_calls agent reference to NULL for historical call records
            await connection.query(`UPDATE telephony_calls SET telephony_agent_id = NULL WHERE telephony_agent_id = ?`, [agentId]);
            // 3. Delete agent mapping record
            await connection.query(`DELETE FROM telephony_agents WHERE id = ?`, [agentId]);
            await connection.commit();
            return { success: true };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Fetch DIDs directly from Acefone API (/v1/my_number) and upsert into database
     */
    static async syncDidsFromAcefone() {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Integration not found");

        const apiToken = await this.getDecryptedToken(integration.id);
        if (!apiToken) throw new Error("Acefone API token is missing");

        const res = await AcefoneProviderService.fetchDids(integration.base_url || 'https://api.acefone.in', apiToken, integration.id);
        
        if (!res.success) {
            const errDetail = res.error && (res.error.message || JSON.stringify(res.error));
            const msg = errDetail ? `${res.message} (${errDetail})` : (res.message || 'Failed to fetch DIDs from Acefone');
            throw new Error(`Acefone DID Sync Failed: ${msg}. Please enable 'My Number / DID Management' scope on your Acefone API token in Acefone Portal.`);
        }

        if (res.success && Array.isArray(res.dids) && res.dids.length > 0) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                for (const item of res.dids) {
                    const acefoneDidId = String(item.id || item.my_number_id || '');
                    const didNumber = String(item.did || item.number || item.alias || '').trim();
                    const displayName = item.name || item.description || 'Virtual DID';
                    const alias = item.alias || '';
                    const destination = item.destination || '';
                    const destinationName = item.destination_name || '';

                    if (didNumber) {
                        await connection.query(`
                            INSERT INTO telephony_dids (
                                integration_id, acefone_did_id, did_number, display_name,
                                alias, destination, destination_name, status, is_available, last_synced_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', TRUE, NOW())
                            ON DUPLICATE KEY UPDATE
                                acefone_did_id = VALUES(acefone_did_id),
                                display_name = VALUES(display_name),
                                alias = VALUES(alias),
                                destination = VALUES(destination),
                                destination_name = VALUES(destination_name),
                                status = 'active',
                                last_synced_at = NOW()
                        `, [integration.id, acefoneDidId, didNumber, displayName, alias, destination, destinationName]);
                    }
                }
                await connection.commit();
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        }

        return await this.getDids();
    }

    /**
     * Get list of all DIDs in inventory joined with CRM user and agent details
     */
    static async getDids() {
        const [rows] = await pool.query(`
            SELECT d.*, 
                   ad.telephony_agent_id,
                   a.crm_user_id as assigned_crm_user_id,
                   u.name as crm_user_name,
                   u.email as crm_user_email,
                   a.agent_name as acefone_agent_name,
                   a.extension as acefone_agent_extension
            FROM telephony_dids d
            LEFT JOIN telephony_agent_dids ad ON ad.did_id = d.id AND ad.is_active = TRUE
            LEFT JOIN telephony_agents a ON a.id = ad.telephony_agent_id AND a.is_active = TRUE
            LEFT JOIN users u ON u.user_id = a.crm_user_id
            ORDER BY d.did_number ASC
        `);
        return rows;
    }

    /**
     * Save/Edit DID Mapping & Details
     */
    static async saveDid({ id, did_number, display_name, crm_user_id, destination_name, status, notes }) {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Integration not found");

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            if (id) {
                await connection.query(`
                    UPDATE telephony_dids
                    SET did_number = COALESCE(?, did_number),
                        display_name = ?,
                        crm_user_id = ?,
                        destination_name = ?,
                        status = ?,
                        notes = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [did_number || null, display_name || 'Virtual Number', crm_user_id || null, destination_name || null, status || 'active', notes || null, id]);
            } else {
                await connection.query(`
                    INSERT INTO telephony_dids (
                        integration_id, did_number, display_name, crm_user_id, destination_name, status, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        did_number = VALUES(did_number),
                        display_name = VALUES(display_name),
                        crm_user_id = VALUES(crm_user_id),
                        destination_name = VALUES(destination_name),
                        status = VALUES(status),
                        notes = VALUES(notes),
                        updated_at = NOW()
                `, [integration.id, did_number, display_name || 'Virtual Number', crm_user_id || null, destination_name || null, status || 'active', notes || null]);
            }

            // Sync with telephony_agent_dids if crm_user_id provided
            if (crm_user_id) {
                const [agents] = await connection.query(`SELECT id FROM telephony_agents WHERE crm_user_id = ? LIMIT 1`, [crm_user_id]);
                if (agents.length > 0) {
                    const agentId = agents[0].id;
                    const targetDidNumber = did_number || (await connection.query(`SELECT did_number FROM telephony_dids WHERE id = ?`, [id]))[0]?.[0]?.did_number;
                    if (targetDidNumber) {
                        const [didRows] = await connection.query(`SELECT id FROM telephony_dids WHERE did_number = ? LIMIT 1`, [targetDidNumber]);
                        if (didRows.length > 0) {
                            await connection.query(`
                                INSERT INTO telephony_agent_dids (telephony_agent_id, did_id, can_outbound, can_inbound, is_active)
                                VALUES (?, ?, TRUE, TRUE, TRUE)
                                ON DUPLICATE KEY UPDATE is_active = TRUE
                            `, [agentId, didRows[0].id]);
                        }
                    }
                }
            }

            await connection.commit();
            return { success: true };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Delete a DID entry manually
     */
    static async deleteDid(didId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(`DELETE FROM telephony_agent_dids WHERE did_id = ?`, [didId]);
            await connection.query(`UPDATE telephony_agents SET default_outbound_did_id = NULL WHERE default_outbound_did_id = ?`, [didId]);
            await connection.query(`UPDATE telephony_calls SET did_id = NULL WHERE did_id = ?`, [didId]);
            await connection.query(`DELETE FROM telephony_dids WHERE id = ?`, [didId]);
            await connection.commit();
            return { success: true };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Map a CRM User to an Acefone Agent and set assigned DIDs
     */
    static async mapAgent({ id, crmUserId, acefoneUserId, acefoneAgentId, agentName, agentPhone, extension, callingChannel, defaultOutboundDidId, didIds, adminUserId }) {
        if (!agentPhone) {
            throw new Error("Agent mobile number is required.");
        }
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Integration not found");

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            let targetAgentId = id ? parseInt(id) : null;

            // 1. Check if target crmUserId is already assigned to another agent
            const [userConflict] = await connection.query(`
                SELECT id, agent_name FROM telephony_agents
                WHERE integration_id = ? AND crm_user_id = ? AND (? IS NULL OR id != ?) AND is_active = TRUE LIMIT 1
            `, [integration.id, crmUserId, targetAgentId, targetAgentId]);

            if (userConflict.length > 0) {
                throw new Error(`CRM user is already mapped to agent '${userConflict[0].agent_name}'. Duplicate user mappings are not allowed.`);
            }

            // 1b. Check that Agent Mobile Number matches CRM User's registered phone number
            const [targetCrmUser] = await connection.query(`SELECT user_id, name, phone FROM users WHERE user_id = ? LIMIT 1`, [crmUserId]);
            if (targetCrmUser.length > 0 && targetCrmUser[0].phone) {
                const crmPhoneDigits = String(targetCrmUser[0].phone || '').replace(/\D/g, '').slice(-10);
                const agentPhoneDigits = String(agentPhone || '').replace(/\D/g, '').slice(-10);
                if (crmPhoneDigits && agentPhoneDigits && crmPhoneDigits !== agentPhoneDigits) {
                    throw new Error(`Validation Error: Agent mobile number (${agentPhone}) must match CRM user's registered phone number (${targetCrmUser[0].phone}).`);
                }
            }

            // 2. Check if Agent Mobile Number is already assigned to another agent
            const cleanPhone = String(agentPhone || '').replace(/\D/g, '').slice(-10);
            if (cleanPhone) {
                const [phoneConflict] = await connection.query(`
                    SELECT id, agent_name, agent_phone FROM telephony_agents
                    WHERE integration_id = ? 
                      AND (
                          agent_phone = ? 
                          OR RIGHT(REGEXP_REPLACE(agent_phone, '[^0-9]', ''), 10) = ?
                      )
                      AND (? IS NULL OR id != ?) 
                      AND is_active = TRUE LIMIT 1
                `, [integration.id, agentPhone, cleanPhone, targetAgentId, targetAgentId]);

                if (phoneConflict.length > 0) {
                    throw new Error(`Mobile number '${agentPhone}' is already assigned to agent '${phoneConflict[0].agent_name}'. Agent mobile numbers must be unique.`);
                }
            }

            // 3. Check if Extension is already assigned to another agent (if extension provided)
            if (extension && extension.trim()) {
                const cleanExt = extension.trim();
                const [extConflict] = await connection.query(`
                    SELECT id, agent_name FROM telephony_agents
                    WHERE integration_id = ? AND extension = ? AND (? IS NULL OR id != ?) AND is_active = TRUE LIMIT 1
                `, [integration.id, cleanExt, targetAgentId, targetAgentId]);

                if (extConflict.length > 0) {
                    throw new Error(`Extension '${cleanExt}' is already assigned to agent '${extConflict[0].agent_name}'. Extensions must be unique.`);
                }
            }

            // 4. Check if any assigned DID is already assigned to another agent
            if (Array.isArray(didIds) && didIds.length > 0) {
                const [didConflicts] = await connection.query(`
                    SELECT ad.did_id, d.did_number, a.agent_name
                    FROM telephony_agent_dids ad
                    JOIN telephony_dids d ON d.id = ad.did_id
                    JOIN telephony_agents a ON a.id = ad.telephony_agent_id
                    WHERE ad.did_id IN (?) AND ad.is_active = TRUE AND a.is_active = TRUE
                      AND (? IS NULL OR ad.telephony_agent_id != ?)
                    LIMIT 1
                `, [didIds, targetAgentId, targetAgentId]);

                if (didConflicts.length > 0) {
                    throw new Error(`DID number '${didConflicts[0].did_number}' is already assigned to agent '${didConflicts[0].agent_name}'. A DID (virtual number) can only be assigned to one agent.`);
                }
            }

            if (targetAgentId) {
                // Update existing agent mapping
                await connection.query(`
                    UPDATE telephony_agents
                    SET crm_user_id = ?,
                        acefone_user_id = ?,
                        acefone_agent_id = ?,
                        agent_name = ?,
                        agent_phone = ?,
                        extension = ?,
                        calling_channel = ?,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = ?
                `, [
                    crmUserId,
                    acefoneUserId || `user_${crmUserId}`,
                    acefoneAgentId || `agent_${crmUserId}`,
                    agentName,
                    agentPhone || null,
                    extension || null,
                    callingChannel || 'extension',
                    targetAgentId
                ]);
            } else {
                // Check if crmUserId already exists in agents
                const [existingUserAgent] = await connection.query(`SELECT id FROM telephony_agents WHERE integration_id = ? AND crm_user_id = ? LIMIT 1`, [integration.id, crmUserId]);
                if (existingUserAgent.length > 0) {
                    targetAgentId = existingUserAgent[0].id;
                    await connection.query(`
                        UPDATE telephony_agents
                        SET acefone_user_id = ?, acefone_agent_id = ?, agent_name = ?, agent_phone = ?, extension = ?, calling_channel = ?, is_active = TRUE, updated_at = NOW()
                        WHERE id = ?
                    `, [
                        acefoneUserId || `user_${crmUserId}`, acefoneAgentId || `agent_${crmUserId}`,
                        agentName, agentPhone || null, extension || null, callingChannel || 'extension', targetAgentId
                    ]);
                } else {
                    const [insertResult] = await connection.query(`
                        INSERT INTO telephony_agents (
                            integration_id, crm_user_id, acefone_user_id, acefone_agent_id,
                            agent_name, agent_phone, extension, calling_channel, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                    `, [
                        integration.id, crmUserId, acefoneUserId || `user_${crmUserId}`, acefoneAgentId || `agent_${crmUserId}`,
                        agentName, agentPhone || null, extension || null, callingChannel || 'extension'
                    ]);
                    targetAgentId = insertResult.insertId;
                }
            }

            // Reset existing DID mappings for this agent so edits update the DID set accurately
            await connection.query(`DELETE FROM telephony_agent_dids WHERE telephony_agent_id = ?`, [targetAgentId]);

            // Map DIDs if provided
            if (Array.isArray(didIds) && didIds.length > 0) {
                for (const didId of didIds) {
                    await connection.query(`
                        INSERT INTO telephony_agent_dids (telephony_agent_id, did_id, can_outbound, can_inbound, is_active, assigned_by)
                        VALUES (?, ?, TRUE, TRUE, TRUE, ?)
                        ON DUPLICATE KEY UPDATE is_active = TRUE, unassigned_at = NULL
                    `, [targetAgentId, didId, adminUserId || null]);
                }
            }

            // Transactional Default Outbound DID Assignment Rule
            if (defaultOutboundDidId) {
                const [validMapping] = await connection.query(`
                    SELECT ad.id FROM telephony_agent_dids ad
                    JOIN telephony_dids d ON d.id = ad.did_id
                    WHERE ad.telephony_agent_id = ? AND ad.did_id = ?
                      AND ad.is_active = TRUE AND ad.can_outbound = TRUE
                      AND d.status = 'active' LIMIT 1
                `, [targetAgentId, defaultOutboundDidId]);

                if (!validMapping || validMapping.length === 0) {
                    throw new Error("Default DID must be an active DID assigned to this agent with outbound permission.");
                }

                await connection.query(`UPDATE telephony_agents SET default_outbound_did_id = ? WHERE id = ?`, [defaultOutboundDidId, targetAgentId]);
            } else {
                await connection.query(`UPDATE telephony_agents SET default_outbound_did_id = NULL WHERE id = ?`, [targetAgentId]);
            }

            await connection.commit();
            return { success: true, agent_id: targetAgentId };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Initiate Click to Call for a Lead / Telecaller
     */
    static async initiateClickToCall({ crmUserId, leadId, destinationPhone }) {
        const integration = await this.getIntegration();
        if (!integration || integration.status !== 'active') {
            throw new Error("Telephony integration is currently inactive or disabled.");
        }

        // Determine target lead & phone number first
        let targetPhone = destinationPhone;
        let leadRecord = null;
        let validLeadId = null;
        if (leadId && !isNaN(parseInt(leadId, 10)) && parseInt(leadId, 10) > 0) {
            const parsedLeadId = parseInt(leadId, 10);
            const [leads] = await pool.query(`SELECT lead_id, phone_number, customer_name, assigned_to FROM leads WHERE lead_id = ? LIMIT 1`, [parsedLeadId]);
            if (leads.length > 0) {
                leadRecord = leads[0];
                targetPhone = targetPhone || leadRecord.phone_number;
                validLeadId = leadRecord.lead_id;
            }
        }

        // Validate logged-in CRM user details
        const [crmUsers] = await pool.query(`SELECT user_id, name, phone, status FROM users WHERE user_id = ? LIMIT 1`, [crmUserId]);
        if (crmUsers.length === 0 || crmUsers[0].status === 'inactive') {
            throw new Error("Validation Failed: Your CRM user account is inactive or not found. Please contact admin.");
        }
        const crmUser = crmUsers[0];

        // Validate agent mapping: MUST be directly mapped to the logged-in CRM user
        let agent = null;
        if (crmUserId) {
            const [matched] = await pool.query(`
                SELECT a.*, d.did_number as default_did_number, d.id as default_did_id
                FROM telephony_agents a
                LEFT JOIN telephony_dids d ON d.id = a.default_outbound_did_id
                WHERE a.crm_user_id = ? AND a.is_active = TRUE LIMIT 1
            `, [crmUserId]);
            if (matched.length > 0) {
                agent = matched[0];
            }
        }

        if (!agent) {
            throw new Error("Validation Failed: You don't have calling access. Your CRM user account is not mapped to any telephony agent. Please contact your administrator.");
        }

        // STRICT PHONE MATCH VALIDATION: Ensure CRM User registered phone matches mapped agent phone
        const crmUserPhoneDigits = String(crmUser.phone || '').replace(/\D/g, '').slice(-10);
        const agentPhoneDigits = String(agent.agent_phone || '').replace(/\D/g, '').slice(-10);

        if (!crmUser.phone || !crmUserPhoneDigits) {
            throw new Error("Validation Failed: Your CRM user profile does not have a registered phone number. Please update your user profile or contact admin.");
        }

        if (agent.calling_channel === 'mobile' || agent.calling_channel === 'both') {
            if (!agentPhoneDigits || crmUserPhoneDigits !== agentPhoneDigits) {
                throw new Error(`Validation Failed: Mismatch between CRM user phone number (${crmUser.phone}) and mapped agent phone number (${agent.agent_phone || 'None'}). Please contact admin or authorized person to fix your telephony mapping.`);
            }
        }

        if (!targetPhone) {
            throw new Error("Target customer phone number is required.");
        }

        // Determine outbound DID assigned to this agent
        let callerId = agent.default_did_number;
        let didId = agent.default_did_id;

        if (!callerId) {
            // Check active assigned DIDs for this agent
            const [mappedDids] = await pool.query(`
                SELECT d.id, d.did_number FROM telephony_agent_dids ad
                JOIN telephony_dids d ON d.id = ad.did_id
                WHERE ad.telephony_agent_id = ? AND ad.is_active = TRUE AND ad.can_outbound = TRUE AND d.status = 'active'
                LIMIT 1
            `, [agent.id]);
            if (mappedDids.length > 0) {
                callerId = mappedDids[0].did_number;
                didId = mappedDids[0].id;
            }
        }

        if (!callerId) {
            throw new Error("You don't have calling access. No active assigned DID (Virtual Number) found for your account. Please ask your administrator to assign a DID.");
        }

        const agentDialNumber = agent.calling_channel === 'mobile' ? agent.agent_phone : (agent.extension || agent.agent_phone);
        if (!agentDialNumber) {
            throw new Error("You don't have calling access. Agent extension or phone number is not configured for your account. Please ask your administrator to update your setup.");
        }

        const token = await this.getDecryptedToken(integration.id);
        if (!token) throw new Error("API token is missing.");

        // LIVE ACEFONE AGENT VALIDATION: Check if agent is registered in live Acefone Portal (/v1/users)
        try {
            const acefoneRes = await AcefoneProviderService.fetchAgents(integration.base_url || 'https://api.acefone.in', token, integration.id);
            if (acefoneRes.success && Array.isArray(acefoneRes.agents) && acefoneRes.agents.length > 0) {
                const targetDigits = String(agentDialNumber).replace(/\D/g, '').slice(-10);
                const isRegisteredInAcefone = acefoneRes.agents.some(a => {
                    const extDigits = String(a.extension || a.ext || a.id || a.user_id || '').replace(/\D/g, '').slice(-10);
                    const mobileDigits = String(a.mobile || a.phone || a.phone_number || '').replace(/\D/g, '').slice(-10);
                    return (extDigits && extDigits === targetDigits) || (mobileDigits && mobileDigits === targetDigits);
                });

                if (!isRegisteredInAcefone) {
                    throw new Error(`Calling Access Error: Your agent phone number/extension (${agentDialNumber}) is NOT registered as an active agent in your Acefone Provider Portal. Please ask your administrator to create your agent account in the Acefone Console.`);
                }
            }
        } catch (checkErr) {
            if (checkErr.message.includes("Calling Access Error")) {
                throw checkErr;
            }
            console.warn("[ACEFONE PRE-CHECK NOTICE]", checkErr.message);
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Create preliminary telephony_calls record
            const [callResult] = await connection.query(`
                INSERT INTO telephony_calls (
                    integration_id, lead_id, crm_user_id, telephony_agent_id, did_id,
                    customer_phone, agent_phone, agent_extension, direction, call_type,
                    calling_channel, provider, technical_status, started_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outbound', 'click_to_call', ?, 'acefone', 'REQUESTED', NOW())
            `, [
                integration.id, validLeadId, crmUserId, agent.id, didId || null,
                targetPhone, agent.agent_phone, agent.extension, agent.calling_channel
            ]);

            const callId = callResult.insertId;
            const customIdentifier = JSON.stringify({ call_id: callId, lead_id: validLeadId, crm_user_id: crmUserId });

            // Call Acefone Provider API
            const c2cResult = await AcefoneProviderService.initiateClickToCall({
                baseUrl: integration.base_url,
                apiToken: token,
                integrationId: integration.id,
                userId: crmUserId,
                agentNumber: agentDialNumber,
                destinationNumber: targetPhone,
                callerId: callerId,
                timeout: integration.default_call_timeout || 3600,
                customIdentifier: customIdentifier
            });

            if (!c2cResult.success) {
                await connection.query(`UPDATE telephony_calls SET technical_status = 'FAILED', hangup_reason = ? WHERE id = ?`, [c2cResult.message, callId]);
                await connection.commit();
                throw new Error(c2cResult.message || "Failed to initiate call with provider");
            }

            // Save acefone_ref_id
            await connection.query(`UPDATE telephony_calls SET acefone_ref_id = ? WHERE id = ?`, [c2cResult.acefone_ref_id, callId]);

            await connection.commit();

            return {
                success: true,
                call_id: callId,
                acefone_ref_id: c2cResult.acefone_ref_id,
                message: `Call initiated to ${targetPhone}. Agent phone/extension will ring first.`
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Get real-time status of a specific call by call_id with live Acefone validation
     */
    static async getCallStatus(callId, crmUserId) {
        const [calls] = await pool.query(`
            SELECT id, integration_id, acefone_call_id, acefone_ref_id, technical_status,
                   hangup_reason, customer_phone, agent_phone, started_at, ended_at,
                   duration_seconds, talk_time_seconds
            FROM telephony_calls
            WHERE id = ? LIMIT 1
        `, [callId]);

        if (calls.length === 0) {
            throw new Error("Call record not found");
        }

        const callRecord = calls[0];

        // If call status is active (not yet terminal), perform live verification against Acefone /v1/live_calls
        if (!['COMPLETED', 'FAILED', 'MISSED', 'BUSY'].includes(callRecord.technical_status)) {
            try {
                const integration = await this.getIntegration();
                if (integration) {
                    const token = await this.getDecryptedToken(integration.id);
                    if (token) {
                        const liveRes = await AcefoneProviderService.fetchLiveCalls(integration.base_url, token, integration.id);
                        if (liveRes.success && Array.isArray(liveRes.live_calls)) {
                            const matched = liveRes.live_calls.find(c => {
                                if (callRecord.acefone_ref_id && c.ref_id === callRecord.acefone_ref_id) return true;
                                if (callRecord.acefone_call_id && c.call_id === callRecord.acefone_call_id) return true;
                                const custDigits = String(callRecord.customer_phone || '').replace(/\D/g, '').slice(-10);
                                const cPhone = String(c.customer_number || c.customer_no_with_prefix || c.call_to_number || c.destination || c.number || '').replace(/\D/g, '');
                                if (custDigits && cPhone && cPhone.includes(custDigits)) return true;
                                return false;
                            });

                            if (matched) {
                                const aceCallId = matched.call_id || callRecord.acefone_call_id;
                                let newStatus = callRecord.technical_status;

                                const [timeDiffRows] = await pool.query(`SELECT TIMESTAMPDIFF(SECOND, started_at, NOW()) as elapsed FROM telephony_calls WHERE id = ?`, [callId]);
                                const elapsed = timeDiffRows[0] ? parseInt(timeDiffRows[0].elapsed) : 0;

                                const isCustomerAnswered = (
                                    matched.customer_status === 'Answered' ||
                                    matched.customer_state === 'Answered' ||
                                    parseInt(matched.outbound_sec || 0, 10) > 0
                                );

                                if (isCustomerAnswered) {
                                    newStatus = 'CONNECTED';
                                } else if (matched.state === 'Answered') {
                                    // Agent answered leg 1, now dialing/ringing customer leg 2
                                    newStatus = 'CUSTOMER_RINGING';
                                } else if (matched.state === 'Ringing' || matched.state === 'Dialing') {
                                    if (callRecord.technical_status === 'REQUESTED' || callRecord.technical_status === 'INITIATING') {
                                        newStatus = 'RINGING_AGENT';
                                    }
                                }

                                if (newStatus !== callRecord.technical_status || (aceCallId && aceCallId !== callRecord.acefone_call_id)) {
                                    await pool.query(`
                                        UPDATE telephony_calls
                                        SET technical_status = ?,
                                            acefone_call_id = COALESCE(?, acefone_call_id)
                                        WHERE id = ?
                                    `, [newStatus, aceCallId, callId]);

                                    callRecord.technical_status = newStatus;
                                    callRecord.acefone_call_id = aceCallId;
                                }
                            } else {
                                // Call is no longer in live_calls (has finished or timed out on Acefone)
                                const [timeDiffRows] = await pool.query(`SELECT TIMESTAMPDIFF(SECOND, started_at, NOW()) as elapsed FROM telephony_calls WHERE id = ?`, [callId]);
                                const elapsed = timeDiffRows[0] ? parseInt(timeDiffRows[0].elapsed) : 0;

                                if (callRecord.technical_status === 'CONNECTED') {
                                    // Call was actively connected with both parties talking
                                    const duration = Math.max(1, elapsed);
                                    if (elapsed > 10800) { // Safety max call limit (3 hours)
                                        await pool.query(`
                                            UPDATE telephony_calls
                                            SET technical_status = 'COMPLETED',
                                                ended_at = COALESCE(ended_at, NOW()),
                                                duration_seconds = GREATEST(duration_seconds, ?),
                                                talk_time_seconds = GREATEST(talk_time_seconds, ?),
                                                hangup_reason = COALESCE(hangup_reason, 'Max call duration limit reached')
                                            WHERE id = ?
                                        `, [duration, duration, callId]);

                                        callRecord.technical_status = 'COMPLETED';
                                        callRecord.duration_seconds = duration;
                                        callRecord.talk_time_seconds = duration;
                                        callRecord.ended_at = new Date();
                                    } else {
                                        await pool.query(`
                                            UPDATE telephony_calls
                                            SET duration_seconds = GREATEST(duration_seconds, ?),
                                                talk_time_seconds = GREATEST(talk_time_seconds, ?)
                                            WHERE id = ?
                                        `, [duration, duration, callId]);

                                        callRecord.duration_seconds = Math.max(callRecord.duration_seconds || 0, duration);
                                        callRecord.talk_time_seconds = Math.max(callRecord.talk_time_seconds || 0, duration);
                                    }
                                } else if (['CUSTOMER_RINGING', 'AGENT_ANSWERED', 'RINGING_AGENT', 'REQUESTED', 'INITIATING'].includes(callRecord.technical_status)) {
                                    // Customer never answered (or agent hung up while waiting). It's a MISSED call with 0 talk time!
                                    await pool.query(`
                                        UPDATE telephony_calls
                                        SET technical_status = 'MISSED',
                                            talk_time_seconds = 0,
                                            ended_at = COALESCE(ended_at, NOW()),
                                            hangup_reason = 'Customer did not answer (Missed)'
                                        WHERE id = ?
                                    `, [callId]);

                                    callRecord.technical_status = 'MISSED';
                                    callRecord.talk_time_seconds = 0;
                                    callRecord.hangup_reason = 'Customer did not answer (Missed)';
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("[LIVE CALL CHECK NOTICE]", err.message);
            }
        }

        return {
            success: true,
            call: callRecord
        };
    }

    /**
     * Derive granular human-readable CRM Call Status and detailed Hangup Reason from Acefone Webhook Payload
     */
    static deriveAcefoneCallStatus(payload) {
        const hangupCause = String(payload.hangup_cause || payload.cause || payload.reason || payload.hangup_cause_key || payload.reason_key || payload.hangup_cause_description || '').toUpperCase();
        const reasonKey = String(payload.reason_key || '').toLowerCase();
        const callStatus = String(payload.call_status || payload.status || '').toLowerCase();
        const eventType = String(payload.event || payload.type || payload.event_type || '').toLowerCase();
        const outboundSec = parseInt(payload.outbound_sec || 0, 10);
        const answeredSec = parseInt(payload.answered_seconds || payload.talk_time || 0, 10);
        const durationSec = parseInt(payload.duration || payload.billsec || payload.call_duration || 0, 10);
        const direction = String(payload.direction || 'outbound').toLowerCase();
        const isHangup = eventType.includes('hangup') || eventType.includes('call_update') || eventType.includes('end') || Boolean(payload.end_stamp);

        // Check if customer explicitly answered in call_flow
        let customerAnsweredInFlow = false;
        if (Array.isArray(payload.call_flow)) {
            customerAnsweredInFlow = payload.call_flow.some(f => 
                (f.dialst === 'Answered' && f.anstime) || 
                (f.type === 'Agent' && f.dialst === 'Answered' && f.anstime && String(f.number || '').replace(/\D/g, '').length >= 10) || 
                Boolean(f.anstime)
            );
        }

        // Terminal failure indicators from Acefone (means customer never answered / disconnected / timed out)
        const isExplicitTerminalFailure = ['missed', 'busy', 'noanswer', 'failed', 'cancelled', 'cancel'].includes(callStatus) ||
                                          reasonKey.includes('noanswer') || reasonKey.includes('cancel') || reasonKey.includes('busy');

        // TRUE CONNECTED & TALKING CONDITION:
        // Both the agent AND the customer must have answered and talked!
        const isCustomerAnswered = !isExplicitTerminalFailure && 
            (callStatus === 'answered' || callStatus === 'connected' || callStatus === 'completed') && 
            (outboundSec > 0 || answeredSec > 0 || customerAnsweredInFlow || (direction === 'inbound' && durationSec > 0));

        let granularStatus = 'Not Received';
        let technicalStatus = 'MISSED';
        let detailReason = 'Call ended or missed';

        // 1. Intermediate Real-time State: Agent Ringing
        if (eventType.includes('dialed on agent') || eventType.includes('ringing agent') || eventType.includes('agent ringing') || eventType.includes('dial on agent')) {
            return { granularStatus: 'Agent Ringing', technicalStatus: 'RINGING_AGENT', detailReason: 'Ringing agent extension/mobile' };
        }

        // 2. Intermediate Real-time State: Agent Answered (Now Ringing Customer)
        if ((eventType.includes('answered by agent') || eventType.includes('agent answered') || Boolean(payload.answered_agent)) && !isCustomerAnswered && !isHangup && !isExplicitTerminalFailure) {
            return { granularStatus: 'Agent Answered', technicalStatus: 'AGENT_ANSWERED', detailReason: 'Agent connected! Now dialing customer...' };
        }

        // 3. Intermediate Real-time State: Customer Ringing
        if (eventType.includes('dialed on customer') || eventType.includes('ringing customer') || eventType.includes('customer ringing') || eventType.includes('dial on customer')) {
            return { granularStatus: 'Calling Customer', technicalStatus: 'CUSTOMER_RINGING', detailReason: 'Customer phone is ringing...' };
        }

        // 4. Intermediate Real-time State: Customer Answered / Call Connected (Live Conversation)
        if (!isExplicitTerminalFailure && (isCustomerAnswered || eventType.includes('answered by customer') || eventType.includes('customer answered') || eventType.includes('connected to agent')) && !isHangup) {
            return { granularStatus: 'Connected', technicalStatus: 'CONNECTED', detailReason: 'Live conversation with agent & customer' };
        }

        // 5. Final Completed State: BOTH agent and customer connected and talked!
        if (isCustomerAnswered) {
            granularStatus = 'Received';
            technicalStatus = 'COMPLETED';

            if (payload.call_flow && Array.isArray(payload.call_flow) && payload.call_flow.length > 0) {
                const lastStep = payload.call_flow[payload.call_flow.length - 1];
                const lastStepStr = JSON.stringify(lastStep).toLowerCase();
                if (lastStepStr.includes('agent') || lastStepStr.includes('extension')) {
                    detailReason = 'Received (Call ended by Agent)';
                } else if (lastStepStr.includes('customer') || lastStepStr.includes('user')) {
                    detailReason = 'Received (Call ended by Customer)';
                } else {
                    detailReason = 'Received & Connected successfully';
                }
            } else {
                detailReason = 'Received & Connected successfully';
            }
            return { granularStatus, technicalStatus, detailReason };
        }

        // 6. Terminal Hangup / Missed / Busy / No-Answer States (Customer did NOT answer or talk)
        if (hangupCause.includes('BUSY') || hangupCause.includes('USER_BUSY') || reasonKey.includes('busy') || callStatus === 'busy') {
            granularStatus = 'Busy';
            technicalStatus = 'BUSY';
            detailReason = 'Customer line was busy / Rejected';
        } else if (hangupCause.includes('UNALLOCATED') || hangupCause.includes('UNASSIGNED') || hangupCause.includes('NO_ROUTE') || reasonKey.includes('unallocated')) {
            granularStatus = 'Switched Off';
            technicalStatus = 'FAILED';
            detailReason = 'Customer number is switched off or invalid / unallocated';
        } else if (hangupCause.includes('ABSENT') || hangupCause.includes('TEMPORARY_FAILURE') || hangupCause.includes('UNAVAILABLE') || hangupCause.includes('OUT_OF_ORDER') || reasonKey.includes('unavailable')) {
            granularStatus = 'Not Reachable';
            technicalStatus = 'FAILED';
            detailReason = 'Customer phone is out of coverage / not reachable';
        } else if (hangupCause.includes('NO_ANSWER') || hangupCause.includes('NO_USER_RESPONSE') || hangupCause.includes('CANCEL') || reasonKey.includes('noanswer') || reasonKey.includes('cancel') || callStatus === 'missed') {
            granularStatus = 'Not Received';
            technicalStatus = 'MISSED';
            detailReason = reasonKey.includes('noanswer') ? 'Customer did not answer (Ringing timeout)' : (hangupCause ? `Call missed (${hangupCause})` : 'Call missed by customer');
        } else {
            granularStatus = 'Not Received';
            technicalStatus = 'MISSED';
            detailReason = hangupCause ? `Call missed (${hangupCause})` : 'Call not received by customer';
        }

        return { granularStatus, technicalStatus, detailReason };
    }

    /**
     * Compute Canonical JSON SHA-256 Hash for Idempotency
     */
    static computeCanonicalEventHash(integrationId, payload) {
        const refId = payload.ref_id || '';
        const callId = payload.call_id || '';
        const uuid = payload.uuid || '';
        const customIdentifier = payload.custom_identifier || '';
        const eventType = payload.event || payload.type || '';
        const eventStatus = payload.status || '';

        // Sort payload object keys deterministically
        const serializeCanonical = (obj) => {
            if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
            if (Array.isArray(obj)) return '[' + obj.map(serializeCanonical).join(',') + ']';
            const keys = Object.keys(obj).sort();
            return '{' + keys.map(k => JSON.stringify(k) + ':' + serializeCanonical(obj[k])).join(',') + '}';
        };

        const canonicalPayload = serializeCanonical(payload || {});
        const rawString = `${integrationId}:${refId}:${callId}:${uuid}:${customIdentifier}:${eventType}:${eventStatus}:${canonicalPayload}`;
        return crypto.createHash('sha256').update(rawString).digest('hex');
    }

    /**
     * Webhook Ingestion & Idempotency Pipeline with Resilient Deadlock Retry
     */
    static async processWebhook({ headers, payload, endpoint }) {
        const integration = await this.getIntegration();
        if (!integration) return { status: 404, message: 'Integration not found' };

        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const providerEventId = payload.event_id || payload.provider_event_id || null;

        // Sanitize headers
        const sanitizedHeaders = { ...headers };
        delete sanitizedHeaders.authorization;
        delete sanitizedHeaders.cookie;

        // Log raw webhook request
        await pool.query(`
            INSERT INTO telephony_webhook_logs (
                integration_id, request_id, provider_event_id, http_method, endpoint,
                headers_json, payload_json, http_status, received_at
            ) VALUES (?, ?, ?, 'POST', ?, ?, ?, 200, NOW())
        `, [integration.id, requestId, providerEventId, endpoint || '/api/integrations/acefone/webhook', JSON.stringify(sanitizedHeaders), JSON.stringify(payload)]);

        // Compute Canonical Hash
        const eventHash = this.computeCanonicalEventHash(integration.id, payload);

        // Retry loop for Deadlock (ER_LOCK_DEADLOCK / 1213)
        for (let attempt = 1; attempt <= 3; attempt++) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // Attempt idempotent insert into telephony_call_events
                const eventType = payload.event || payload.type || 'call_update';
                const eventStatus = payload.status || payload.call_status || null;
                const refId = payload.ref_id || payload.custom_identifier_ref || null;
                const acefoneCallId = payload.call_id || null;
                const acefoneUuid = payload.uuid || null;

                // Try to find corresponding call
                let callId = null;
                if (refId) {
                    const [calls] = await connection.query(`SELECT id FROM telephony_calls WHERE integration_id = ? AND acefone_ref_id = ? LIMIT 1`, [integration.id, refId]);
                    if (calls.length > 0) callId = calls[0].id;
                }
                if (!callId && acefoneCallId) {
                    const [calls] = await connection.query(`SELECT id FROM telephony_calls WHERE integration_id = ? AND acefone_call_id = ? LIMIT 1`, [integration.id, acefoneCallId]);
                    if (calls.length > 0) callId = calls[0].id;
                }
                if (!callId && payload.custom_identifier) {
                    try {
                        const parsedCustom = typeof payload.custom_identifier === 'string' ? JSON.parse(payload.custom_identifier) : payload.custom_identifier;
                        if (parsedCustom && parsedCustom.call_id) {
                            const [calls] = await connection.query(`SELECT id FROM telephony_calls WHERE integration_id = ? AND id = ? LIMIT 1`, [integration.id, parsedCustom.call_id]);
                            if (calls.length > 0) callId = calls[0].id;
                        }
                    } catch (e) {}
                }
                if (!callId) {
                    const custDigits = String(payload.call_to_number || payload.customer_number || payload.destination || payload.customer_no_with_prefix || '').replace(/\D/g, '').slice(-10);
                    if (custDigits && custDigits.length >= 8) {
                        const [calls] = await connection.query(`
                            SELECT id FROM telephony_calls
                            WHERE integration_id = ?
                              AND ended_at IS NULL
                              AND customer_phone LIKE ?
                              AND started_at >= NOW() - INTERVAL 15 MINUTE
                            ORDER BY id DESC LIMIT 1
                        `, [integration.id, `%${custDigits}`]);
                        if (calls.length > 0) callId = calls[0].id;
                    }
                }

                try {
                    await connection.query(`
                        INSERT INTO telephony_call_events (
                            integration_id, call_id, acefone_ref_id, acefone_call_id, acefone_uuid,
                            provider_event_id, event_type, event_status, payload_json, received_at,
                            processing_status, event_hash
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending', ?)
                    `, [integration.id, callId, refId, acefoneCallId, acefoneUuid, providerEventId, eventType, eventStatus, JSON.stringify(payload), eventHash]);
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('uk_event_hash')) {
                        await connection.commit();
                        return { status: 200, message: 'Duplicate webhook event ignored idempotently' };
                    }
                    throw err;
                }

                // Update call technical status & granular hangup reason
                if (callId) {
                    const derived = this.deriveAcefoneCallStatus(payload);
                    const techStatus = derived.technicalStatus;
                    const duration = parseInt(payload.duration || payload.billsec || payload.call_duration || 0, 10);
                    
                    // ACCURATE TALK TIME: Only count talk time if the customer actually answered!
                    let talkTime = 0;
                    if (techStatus === 'COMPLETED' || techStatus === 'CONNECTED') {
                        const outboundSec = parseInt(payload.outbound_sec || 0, 10);
                        const answeredSec = parseInt(payload.answered_seconds || payload.talk_time || 0, 10);
                        talkTime = outboundSec > 0 ? outboundSec : (answeredSec > 0 ? answeredSec : 0);
                        if (talkTime === 0 && (payload.direction === 'inbound' || String(payload.direction).toLowerCase() === 'inbound')) {
                            talkTime = parseInt(payload.billsec || payload.duration || 0, 10);
                        }
                    } else {
                        talkTime = 0;
                    }

                    const hangupReason = derived.detailReason;
                    const hangupCause = payload.hangup_cause || payload.cause || payload.reason || payload.hangup_cause_description || null;

                    await connection.query(`
                        UPDATE telephony_calls
                        SET technical_status = ?,
                            hangup_cause = COALESCE(?, hangup_cause),
                            hangup_reason = ?,
                            acefone_call_id = COALESCE(?, acefone_call_id),
                            acefone_uuid = COALESCE(?, acefone_uuid),
                            duration_seconds = GREATEST(duration_seconds, ?),
                            talk_time_seconds = ?,
                            ended_at = IF(? IN ('COMPLETED', 'FAILED', 'MISSED', 'BUSY', 'NO_ANSWER'), NOW(), ended_at),
                            is_recorded = IF(?, TRUE, is_recorded)
                        WHERE id = ?
                    `, [techStatus, hangupCause, hangupReason, acefoneCallId, acefoneUuid, duration, talkTime, techStatus, Boolean(payload.recording_url), callId]);

                    if (payload.recording_url) {
                        this.processRecordingAsync(integration.id, callId, payload.recording_url);
                    }
                } else if (acefoneCallId || refId || payload.call_to_number || payload.customer_number) {
                    // Create new call record if webhook arrives for a call not yet in telephony_calls
                    const derived = this.deriveAcefoneCallStatus(payload);
                    const techStatus = derived.technicalStatus;
                    const duration = parseInt(payload.duration || payload.billsec || payload.call_duration || 0, 10);
                    let talkTime = 0;
                    if (techStatus === 'COMPLETED' || techStatus === 'CONNECTED') {
                        const outboundSec = parseInt(payload.outbound_sec || 0, 10);
                        const answeredSec = parseInt(payload.answered_seconds || payload.talk_time || 0, 10);
                        talkTime = outboundSec > 0 ? outboundSec : (answeredSec > 0 ? answeredSec : 0);
                        if (talkTime === 0 && (payload.direction === 'inbound' || String(payload.direction).toLowerCase() === 'inbound')) {
                            talkTime = parseInt(payload.billsec || payload.duration || 0, 10);
                        }
                    }

                    // Parse started_at from payload start_stamp (in IST)
                    let startedAt = new Date();
                    if (payload.start_stamp) {
                        const rawStart = String(payload.start_stamp).trim().replace(' ', 'T');
                        const parsed = new Date(`${rawStart}+05:30`);
                        if (!isNaN(parsed.getTime())) startedAt = parsed;
                    }

                    const custPhone = String(payload.call_to_number || payload.customer_number || payload.destination || payload.customer_no_with_prefix || '').replace(/\D/g, '').slice(-10);
                    const agentPhone = String(payload.answered_agent?.number || payload.agent_number || payload.caller_id_number || '').replace(/\D/g, '').slice(-10);
                    const direction = (payload.direction || 'outbound').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';

                    // Find matched agent & lead
                    const [agentMatch] = await connection.query(`
                        SELECT a.id as agent_id, a.crm_user_id 
                        FROM telephony_agents a 
                        WHERE a.agent_phone LIKE ? OR a.extension = ? LIMIT 1
                    `, [`%${agentPhone}`, payload.answered_agent?.id || null]);
                    let crmUserId = agentMatch[0]?.crm_user_id || null;
                    let telephonyAgentId = agentMatch[0]?.agent_id || null;

                    let leadId = null;
                    if (custPhone) {
                        const [leadMatch] = await connection.query(`SELECT lead_id, assigned_to FROM leads WHERE phone_number LIKE ? LIMIT 1`, [`%${custPhone}`]);
                        if (leadMatch.length > 0) {
                            leadId = leadMatch[0].lead_id;
                            if (!crmUserId && leadMatch[0].assigned_to) crmUserId = leadMatch[0].assigned_to;
                        }
                    }

                    const [insertRes] = await connection.query(`
                        INSERT INTO telephony_calls (
                            integration_id, acefone_call_id, acefone_uuid, acefone_ref_id, direction,
                            customer_phone, agent_phone, crm_user_id, telephony_agent_id,
                            lead_id, technical_status, started_at, ended_at,
                            duration_seconds, talk_time_seconds, hangup_cause, hangup_reason,
                            is_recorded
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
                    `, [
                        integration.id, acefoneCallId, acefoneUuid, refId, direction,
                        custPhone, agentPhone, crmUserId, telephonyAgentId,
                        leadId, techStatus, startedAt,
                        duration, talkTime, payload.hangup_cause || payload.cause || payload.reason || payload.hangup_cause_description || null,
                        derived.detailReason, Boolean(payload.recording_url)
                    ]);
                    callId = insertRes.insertId;

                    if (payload.recording_url && callId) {
                        this.processRecordingAsync(integration.id, callId, payload.recording_url);
                    }
                }

                await connection.commit();
                
                // Update integration timestamp outside transaction to prevent deadlocks
                pool.query(`UPDATE telephony_integrations SET last_webhook_at = NOW() WHERE id = ?`, [integration.id]).catch(e => {});

                return { status: 200, message: 'Webhook processed successfully' };
            } catch (err) {
                await connection.rollback();
                const isDeadlock = err.code === 'ER_LOCK_DEADLOCK' || err.errno === 1213 || err.message.includes('Deadlock');
                if (isDeadlock && attempt < 3) {
                    console.warn(`[WEBHOOK DEADLOCK RETRY ${attempt}/3] Retrying deadlock for request ${requestId}...`);
                    await new Promise(r => setTimeout(r, 100 * attempt));
                    continue;
                }
                console.error("❌ Webhook Pipeline Error:", err.message);
                return { status: 500, message: err.message };
            } finally {
                connection.release();
            }
        }
    }

    /**
     * Download recording from Acefone and stream to Cloudflare R2
     */
    static async processRecordingAsync(integrationId, callId, recordingUrl, customCallId = null) {
        if (!recordingUrl || !recordingUrl.startsWith('http')) return null;
        try {
            const r2Bucket = process.env.R2_BUCKET || 'sgb-crm-media';
            const callRef = customCallId || callId;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const cleanCallRef = String(callRef).replace(/[^a-zA-Z0-9._-]/g, '_');
            const objectKey = `telephony/recordings/${year}/${month}/call_${cleanCallRef}.mp3`;

            const response = await axios.get(recordingUrl, { responseType: 'arraybuffer', timeout: 30000 });
            const buffer = Buffer.from(response.data);

            if (buffer.length === 0) {
                console.warn(`⚠️ Acefone recording buffer empty for Call ${callId}`);
                return null;
            }

            await storageService.uploadObject({
                key: objectKey,
                body: buffer,
                contentType: 'audio/mpeg',
                bucket: r2Bucket
            });

            const publicUrl = storageService.getPublicUrl(objectKey, r2Bucket);

            await pool.query(`
                INSERT INTO telephony_recordings (
                    call_id, integration_id, acefone_recording_url, r2_bucket, r2_object_key,
                    file_name, mime_type, file_size_bytes, upload_status, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'audio/mpeg', ?, 'uploaded', NOW())
                ON DUPLICATE KEY UPDATE
                    r2_bucket = VALUES(r2_bucket),
                    r2_object_key = VALUES(r2_object_key),
                    file_size_bytes = VALUES(file_size_bytes),
                    upload_status = 'uploaded',
                    uploaded_at = NOW()
            `, [callId, integrationId, recordingUrl, r2Bucket, objectKey, `call_${cleanCallRef}.mp3`, buffer.length]);

            await pool.query(`UPDATE telephony_calls SET is_recorded = TRUE WHERE id = ?`, [callId]);
            console.log(`  🎵 Call ${callId} recording offloaded to Cloudflare R2: ${objectKey}`);
            return { objectKey, publicUrl };
        } catch (err) {
            console.error(`❌ Failed R2 Recording Offloading for Call ${callId}:`, err.message);
            return null;
        }
    }

    /**
     * Sync CDR records from Acefone API (/v1/call/records)
     */
    static async syncCdrFromAcefone({ page = 1, limit = 50, fromDate, toDate, autoOffloadAudio = true } = {}) {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Telephony integration not found");

        const token = await this.getDecryptedToken(integration.id);
        if (!token) throw new Error("No active API token configured");

        const cdrRes = await AcefoneProviderService.fetchCdrRecords({
            baseUrl: integration.base_url,
            apiToken: token,
            integrationId: integration.id,
            page,
            limit,
            fromDate,
            toDate
        });

        if (!cdrRes.success || !Array.isArray(cdrRes.records)) {
            return {
                success: false,
                message: cdrRes.message || 'Failed to retrieve CDR records from Acefone',
                synced_count: 0
            };
        }

        let syncedCount = 0;
        const connection = await pool.getConnection();
        try {
            const [agents] = await connection.query(`SELECT id, crm_user_id, agent_phone, agent_name, extension FROM telephony_agents WHERE is_active = TRUE`);
            const [allUsers] = await connection.query(`SELECT user_id, phone, name FROM users WHERE phone IS NOT NULL AND phone != ''`);

            for (const item of cdrRes.records) {
                const acefoneCallId = item.call_id || item.id;
                const acefoneUuid = item.uuid || null;
                const direction = (item.direction || 'outbound').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';

                // Map status accurately
                const rawStatus = (item.status || '').toLowerCase();
                const durationSec = parseInt(item.call_duration || item.duration || 0, 10);
                const talkSec = parseInt(item.answered_seconds || item.talk_time || 0, 10);
                const ringSec = parseInt(item.agent_ring_time || 0, 10) || 0;

                // TRUE CONNECTED & TALKING: only connected if status is answered AND talkSec > 0!
                let techStatus = 'MISSED';
                if ((rawStatus === 'answered' || rawStatus === 'connected' || rawStatus === 'completed') && talkSec > 0) {
                    techStatus = 'CONNECTED';
                } else if (rawStatus === 'busy') {
                    techStatus = 'BUSY';
                } else if (rawStatus === 'noanswer' || rawStatus === 'no_answer') {
                    techStatus = 'NO_ANSWER';
                } else if (rawStatus === 'failed' || rawStatus === 'rejected') {
                    techStatus = 'FAILED';
                } else {
                    techStatus = 'MISSED';
                }

                const finalTalkSec = techStatus === 'CONNECTED' ? talkSec : 0;

                // Acefone CDR date, time, and end_stamp are in Indian Standard Time (IST / UTC+05:30)
                let startedAt = new Date();
                if (item.date && item.time) {
                    const rawTime = String(item.time).trim();
                    const rawDate = String(item.date).trim();
                    const parsed = new Date(`${rawDate}T${rawTime}+05:30`);
                    startedAt = isNaN(parsed.getTime()) ? new Date() : parsed;
                } else if (item.created_at) {
                    startedAt = new Date(item.created_at);
                }

                let endedAt = null;
                if (item.end_stamp) {
                    const rawEnd = String(item.end_stamp).trim().replace(' ', 'T');
                    const parsedEnd = new Date(`${rawEnd}+05:30`);
                    endedAt = isNaN(parsedEnd.getTime()) ? null : parsedEnd;
                }

                const rawCustPhone = item.client_number || item.customer_number || item.destination_number || item.callerid || '';
                const cleanCustPhone = String(rawCustPhone).replace(/\D/g, '').slice(-10);

                const rawAgentPhone = item.agent_number || item.agent_number_with_prefix || '';
                const cleanAgentPhone = String(rawAgentPhone).replace(/\D/g, '').slice(-10);
                const matchedAgent = agents.find(a => 
                    (cleanAgentPhone && a.agent_phone && a.agent_phone.includes(cleanAgentPhone)) ||
                    (item.agent_name && a.agent_name && a.agent_name.toLowerCase() === item.agent_name.toLowerCase()) ||
                    (item.agent_id && String(a.extension) === String(item.agent_id))
                );

                let crmUserId = matchedAgent ? matchedAgent.crm_user_id : null;
                let agentId = matchedAgent ? matchedAgent.id : null;

                // If not matched in telephony_agents, check users table by phone
                if (!crmUserId && cleanAgentPhone) {
                    const matchedUser = allUsers.find(u => {
                        const uPhone = String(u.phone).replace(/\D/g, '').slice(-10);
                        return uPhone && uPhone === cleanAgentPhone;
                    });
                    if (matchedUser) {
                        crmUserId = matchedUser.user_id;
                    }
                }

                // If agent has a telephony_agent profile for this crmUserId
                if (crmUserId && !agentId) {
                    const existingAgent = agents.find(a => a.crm_user_id === crmUserId);
                    if (existingAgent) {
                        agentId = existingAgent.id;
                    }
                }

                let leadId = null;
                if (cleanCustPhone) {
                    const [leads] = await connection.query(`SELECT lead_id, assigned_to FROM leads WHERE phone_number LIKE ? LIMIT 1`, [`%${cleanCustPhone}`]);
                    if (leads.length > 0) {
                        leadId = leads[0].lead_id;
                        if (!crmUserId && leads[0].assigned_to) {
                            crmUserId = leads[0].assigned_to;
                        }
                    }
                }

                const [existing] = await connection.query(`
                    SELECT id, is_recorded FROM telephony_calls 
                    WHERE (acefone_call_id = ? AND acefone_call_id IS NOT NULL)
                       OR (acefone_uuid = ? AND acefone_uuid IS NOT NULL)
                    LIMIT 1
                `, [acefoneCallId, acefoneUuid]);

                let targetDbCallId = null;
                if (existing.length > 0) {
                    targetDbCallId = existing[0].id;
                    await connection.query(`
                        UPDATE telephony_calls SET
                            direction = ?,
                            technical_status = ?,
                            duration_seconds = ?,
                            talk_time_seconds = ?,
                            ring_time_seconds = ?,
                            started_at = ?,
                            ended_at = ?,
                            customer_phone = COALESCE(NULLIF(customer_phone, ''), ?),
                            agent_phone = COALESCE(NULLIF(agent_phone, ''), ?),
                            crm_user_id = COALESCE(crm_user_id, ?),
                            telephony_agent_id = COALESCE(telephony_agent_id, ?),
                            lead_id = COALESCE(lead_id, ?),
                            hangup_reason = ?
                        WHERE id = ?
                    `, [
                        direction, techStatus, durationSec, finalTalkSec, ringSec,
                        startedAt, endedAt, cleanCustPhone || rawCustPhone,
                        cleanAgentPhone || rawAgentPhone, crmUserId, agentId, leadId,
                        item.description || item.hangup_cause || item.reason || (techStatus === 'MISSED' ? 'Call missed by customer' : 'Connected successfully'),
                        targetDbCallId
                    ]);
                } else {
                    const [insRes] = await connection.query(`
                        INSERT INTO telephony_calls (
                            integration_id, acefone_call_id, acefone_uuid, direction,
                            customer_phone, agent_phone, crm_user_id, telephony_agent_id,
                            lead_id, technical_status, started_at, ended_at,
                            duration_seconds, talk_time_seconds, ring_time_seconds,
                            hangup_reason
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        integration.id, acefoneCallId, acefoneUuid, direction,
                        cleanCustPhone || rawCustPhone, cleanAgentPhone || rawAgentPhone,
                        crmUserId, agentId, leadId, techStatus, startedAt, endedAt,
                        durationSec, finalTalkSec, ringSec,
                        item.description || item.hangup_cause || item.reason || (techStatus === 'MISSED' ? 'Call missed by customer' : 'Connected successfully')
                    ]);
                    targetDbCallId = insRes.insertId;
                }

                if (autoOffloadAudio && item.recording_url && targetDbCallId) {
                    this.processRecordingAsync(integration.id, targetDbCallId, item.recording_url, acefoneCallId)
                        .catch(e => console.warn(`Recording offload warn for ${targetDbCallId}:`, e.message));
                }

                syncedCount++;
            }

            await connection.query(`UPDATE telephony_integrations SET last_sync_at = NOW() WHERE id = ?`, [integration.id]);

            return {
                success: true,
                message: `Successfully synced ${syncedCount} CDR records from Acefone`,
                synced_count: syncedCount,
                total_acefone_records: cdrRes.count
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Get Call Logs / CDR with pagination, filters, and KPI stats
     */
    static async getCallLogs({ page = 1, limit = 25, search = '', status = '', direction = '', telecaller = '', crmUserId = null, lead_id = null }) {
        const offset = (page - 1) * limit;
        let whereClause = `WHERE 1=1`;
        const params = [];

        if (crmUserId) {
            whereClause += ` AND c.crm_user_id = ?`;
            params.push(crmUserId);
        }

        if (lead_id) {
            whereClause += ` AND c.lead_id = ?`;
            params.push(lead_id);
        }
        if (search) {
            whereClause += ` AND (c.customer_phone LIKE ? OR u.name LIKE ? OR l.customer_name LIKE ? OR c.acefone_call_id LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        if (status && status !== 'All') {
            whereClause += ` AND c.technical_status = ?`;
            params.push(status.toUpperCase());
        }
        if (direction && direction !== 'All') {
            whereClause += ` AND c.direction = ?`;
            params.push(direction.toLowerCase());
        }
        if (telecaller && telecaller !== 'All') {
            whereClause += ` AND (u.name = ? OR a.agent_name = ?)`;
            params.push(telecaller, telecaller);
        }

        const [rows] = await pool.query(`
            SELECT c.*, u.name as crm_user_name, a.agent_name, a.extension as agent_extension,
                   l.customer_name, l.lead_id,
                   d.did_number, r.r2_object_key, r.acefone_recording_url, r.upload_status as recording_status
            FROM telephony_calls c
            LEFT JOIN users u ON u.user_id = c.crm_user_id
            LEFT JOIN telephony_agents a ON a.id = c.telephony_agent_id
            LEFT JOIN leads l ON l.lead_id = c.lead_id
            LEFT JOIN telephony_dids d ON d.id = c.did_id
            LEFT JOIN telephony_recordings r ON r.call_id = c.id
            ${whereClause}
            ORDER BY c.started_at DESC, c.id DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const [totalRows] = await pool.query(`
            SELECT COUNT(*) as cnt 
            FROM telephony_calls c 
            LEFT JOIN users u ON u.user_id = c.crm_user_id
            LEFT JOIN telephony_agents a ON a.id = c.telephony_agent_id
            LEFT JOIN leads l ON l.lead_id = c.lead_id
            ${whereClause}
        `, params);

        // Calculate KPI summary stats for current filter
        const [statsRows] = await pool.query(`
            SELECT 
                COUNT(*) as total_calls,
                SUM(CASE WHEN c.technical_status IN ('CONNECTED', 'COMPLETED') AND c.talk_time_seconds > 0 THEN 1 ELSE 0 END) as connected_calls,
                SUM(CASE WHEN c.technical_status = 'MISSED' OR (c.technical_status IN ('CONNECTED', 'COMPLETED') AND c.talk_time_seconds = 0) THEN 1 ELSE 0 END) as missed_calls,
                SUM(CASE WHEN c.technical_status = 'BUSY' THEN 1 ELSE 0 END) as busy_calls,
                SUM(CASE WHEN c.technical_status = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer_calls,
                COALESCE(SUM(c.talk_time_seconds), 0) as total_talk_time_seconds,
                COUNT(DISTINCT c.customer_phone) as unique_customers
            FROM telephony_calls c
            LEFT JOIN users u ON u.user_id = c.crm_user_id
            LEFT JOIN telephony_agents a ON a.id = c.telephony_agent_id
            LEFT JOIN leads l ON l.lead_id = c.lead_id
            ${whereClause}
        `, params);

        const stats = statsRows[0] || {};
        const totalCalls = parseInt(stats.total_calls || 0, 10);
        const connectedCalls = parseInt(stats.connected_calls || 0, 10);
        const missedCalls = parseInt(stats.missed_calls || 0, 10);
        const totalTalkTimeSec = parseInt(stats.total_talk_time_seconds || 0, 10);
        const uniqueCust = parseInt(stats.unique_customers || 0, 10);

        const hours = Math.floor(totalTalkTimeSec / 3600);
        const minutes = Math.floor((totalTalkTimeSec % 3600) / 60);
        const talkTimeFormatted = `${hours}h ${minutes}m`;

        const connectedPct = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
        const missedPct = totalCalls > 0 ? Math.round((missedCalls / totalCalls) * 100) : 0;

        const defaultBucket = process.env.R2_BUCKET || 'sgb-crm-media';
        const formattedCalls = rows.map(r => {
            let recordingUrl = null;
            if (r.r2_object_key) {
                recordingUrl = storageService.getPublicUrl(r.r2_object_key, defaultBucket);
            } else if (r.acefone_recording_url) {
                recordingUrl = r.acefone_recording_url;
            }
            return {
                ...r,
                recording_url: recordingUrl
            };
        });

        return {
            calls: formattedCalls,
            total: totalRows[0]?.cnt || 0,
            page: parseInt(page),
            limit: parseInt(limit),
            stats: {
                total_calls: totalCalls,
                connected_calls: connectedCalls,
                missed_calls: missedCalls,
                busy_calls: parseInt(stats.busy_calls || 0, 10),
                no_answer_calls: parseInt(stats.no_answer_calls || 0, 10),
                total_talk_time_seconds: totalTalkTimeSec,
                talk_time_formatted: talkTimeFormatted,
                unique_customers: uniqueCust,
                connected_pct: connectedPct,
                missed_pct: missedPct
            }
        };
    }

    /**
     * Get recent calls for mobile telecaller app
     */
    static async getRecentCalls({ crmUserId = null, limit = 50, search = '' } = {}) {
        let whereClause = `WHERE 1=1`;
        const params = [];

        if (crmUserId) {
            // 1. Fetch user phone from users table
            const [userRows] = await pool.query('SELECT phone FROM users WHERE user_id = ?', [crmUserId]);
            const userPhone = userRows[0]?.phone ? String(userRows[0].phone).replace(/\D/g, '').slice(-10) : null;

            // 2. Fetch telephony agent profile
            const [agentRows] = await pool.query(
                'SELECT id, agent_phone, extension, default_outbound_did_id FROM telephony_agents WHERE crm_user_id = ?',
                [crmUserId]
            );
            const agentIds = agentRows.map(a => a.id);
            const agentPhones = agentRows.map(a => String(a.agent_phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean);
            if (userPhone && !agentPhones.includes(userPhone)) agentPhones.push(userPhone);
            const extensions = agentRows.map(a => String(a.extension)).filter(e => e && e !== 'null');

            // 3. Fetch assigned DIDs
            let assignedDidIds = [];
            if (agentIds.length > 0) {
                const [didRows] = await pool.query(`
                    SELECT did_id FROM telephony_agent_dids WHERE telephony_agent_id IN (?)
                    UNION
                    SELECT default_outbound_did_id as did_id FROM telephony_agents WHERE crm_user_id = ? AND default_outbound_did_id IS NOT NULL
                `, [agentIds, crmUserId]);
                assignedDidIds = didRows.map(d => d.did_id).filter(Boolean);
            }

            // Build agent filter conditions
            const agentConditions = ['c.crm_user_id = ?'];
            const agentParams = [crmUserId];

            if (agentIds.length > 0) {
                agentConditions.push('c.telephony_agent_id IN (?)');
                agentParams.push(agentIds);
            }
            if (agentPhones.length > 0) {
                agentConditions.push(`RIGHT(REPLACE(REPLACE(REPLACE(c.agent_phone, '+91', ''), ' ', ''), '-', ''), 10) IN (?)`);
                agentParams.push(agentPhones);
            }
            if (extensions.length > 0) {
                agentConditions.push('c.agent_extension IN (?)');
                agentParams.push(extensions);
            }
            if (assignedDidIds.length > 0) {
                agentConditions.push(`(c.direction = 'inbound' AND c.did_id IN (?))`);
                agentParams.push(assignedDidIds);
            }
            agentConditions.push('(c.crm_user_id IS NULL AND l.assigned_to = ?)');
            agentParams.push(crmUserId);

            whereClause += ` AND (${agentConditions.join(' OR ')})`;
            params.push(...agentParams);
        }

        if (search) {
            whereClause += ` AND (c.customer_phone LIKE ? OR l.customer_name LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }

        const [rows] = await pool.query(`
            SELECT c.id, c.acefone_call_id, c.acefone_ref_id, c.direction,
                   c.customer_phone, c.agent_phone, c.started_at, c.ended_at,
                   c.duration_seconds, c.talk_time_seconds, c.technical_status,
                   c.hangup_reason, c.is_recorded,
                   COALESCE(a.agent_name, u.name) as agent_name,
                   u.name as crm_user_name,
                   l.customer_name, l.lead_id,
                   d.did_number,
                   r.r2_object_key, r.acefone_recording_url, r.upload_status as recording_status
            FROM telephony_calls c
            LEFT JOIN users u ON u.user_id = c.crm_user_id
            LEFT JOIN telephony_agents a ON a.id = c.telephony_agent_id
            LEFT JOIN leads l ON l.lead_id = c.lead_id
            LEFT JOIN telephony_dids d ON d.id = c.did_id
            LEFT JOIN telephony_recordings r ON r.call_id = c.id
            ${whereClause}
            ORDER BY c.started_at DESC, c.id DESC
            LIMIT ?
        `, [...params, parseInt(limit)]);

        const defaultBucket = process.env.R2_BUCKET || 'sgb-crm-media';
        return rows.map(r => {
            let recordingUrl = null;
            if (r.r2_object_key) {
                recordingUrl = storageService.getPublicUrl(r.r2_object_key, defaultBucket);
            } else if (r.acefone_recording_url) {
                recordingUrl = r.acefone_recording_url;
            }
            return {
                ...r,
                recording_url: recordingUrl
            };
        });
    }

    /**
     * Get single call details with events and lead context
     */
    static async getCallDetails(callId) {
        const [rows] = await pool.query(`
            SELECT c.*, u.name as crm_user_name, u.email as crm_user_email,
                   a.agent_name, a.extension as agent_extension,
                   l.customer_name, l.status as lead_status, l.current_crop, l.acreage, l.city, l.district, l.state,
                   d.did_number, d.display_name as did_display_name,
                   r.r2_object_key, r.acefone_recording_url, r.file_size_bytes, r.upload_status as recording_status
            FROM telephony_calls c
            LEFT JOIN users u ON u.user_id = c.crm_user_id
            LEFT JOIN telephony_agents a ON a.id = c.telephony_agent_id
            LEFT JOIN leads l ON l.lead_id = c.lead_id
            LEFT JOIN telephony_dids d ON d.id = c.did_id
            LEFT JOIN telephony_recordings r ON r.call_id = c.id
            WHERE c.id = ? OR c.acefone_call_id = ?
            LIMIT 1
        `, [callId, String(callId)]);

        if (rows.length === 0) return null;
        const call = rows[0];

        const defaultBucket = process.env.R2_BUCKET || 'sgb-crm-media';
        if (call.r2_object_key) {
            call.recording_url = storageService.getPublicUrl(call.r2_object_key, defaultBucket);
        } else if (call.acefone_recording_url) {
            call.recording_url = call.acefone_recording_url;
        } else {
            call.recording_url = null;
        }

        const [events] = await pool.query(`
            SELECT id, event_type, event_status, received_at
            FROM telephony_call_events
            WHERE call_id = ?
            ORDER BY received_at ASC
        `, [call.id]);

        call.events = events;
        return call;
    }

    /**
     * Get derived telecaller performance metrics
     */
    static async getPerformanceMetrics() {
        const [rows] = await pool.query(`
            SELECT 
                u.user_id,
                u.name as agent_name,
                COUNT(c.id) as total_calls,
                SUM(CASE WHEN (c.technical_status = 'CONNECTED' OR c.technical_status = 'COMPLETED') AND c.talk_time_seconds > 0 THEN 1 ELSE 0 END) as connected_calls,
                SUM(CASE WHEN c.technical_status = 'MISSED' OR ((c.technical_status = 'CONNECTED' OR c.technical_status = 'COMPLETED') AND c.talk_time_seconds = 0) THEN 1 ELSE 0 END) as missed_calls,
                SUM(CASE WHEN c.technical_status = 'BUSY' THEN 1 ELSE 0 END) as busy_calls,
                SUM(c.talk_time_seconds) as total_talk_time_seconds,
                ROUND(AVG(c.duration_seconds)) as avg_duration_seconds
            FROM users u
            JOIN telephony_agents a ON a.crm_user_id = u.user_id
            LEFT JOIN telephony_calls c ON c.crm_user_id = u.user_id AND c.started_at >= CURDATE()
            WHERE a.is_active = TRUE
            GROUP BY u.user_id, u.name
            ORDER BY connected_calls DESC
        `);
        return rows;
    }

    /**
     * Hang up / cancel active call
     */
    static async hangupCall(callId, crmUserId) {
        const integration = await this.getIntegration();
        if (!integration) throw new Error("Integration not found");

        const [calls] = await pool.query(`SELECT id, acefone_call_id, acefone_ref_id, customer_phone, agent_phone, technical_status FROM telephony_calls WHERE id = ? LIMIT 1`, [callId]);
        if (calls.length === 0) throw new Error("Call record not found");

        const callRecord = calls[0];

        if (['COMPLETED', 'FAILED', 'MISSED', 'BUSY'].includes(callRecord.technical_status)) {
            return { success: true, message: "Call already terminated" };
        }

        const token = await this.getDecryptedToken(integration.id);
        let hangupResult = { success: true };

        if (token) {
            hangupResult = await AcefoneProviderService.hangupCall({
                baseUrl: integration.base_url,
                apiToken: token,
                integrationId: integration.id,
                userId: crmUserId,
                callId: callRecord.acefone_call_id,
                refId: callRecord.acefone_ref_id,
                customerPhone: callRecord.customer_phone,
                agentPhone: callRecord.agent_phone
            });
        }

        // Verify provider hangup result before updating DB to COMPLETED
        const isProviderSuccess = hangupResult && (
            hangupResult.success === true &&
            (!hangupResult.data || hangupResult.data.success !== false)
        );

        if (!isProviderSuccess) {
            const errorMsg = hangupResult.message || (hangupResult.error && hangupResult.error.message) || "Acefone provider was unable to terminate the active call line.";
            return {
                success: false,
                message: `Provider Disconnection Failed: ${errorMsg}`,
                provider_result: hangupResult
            };
        }

        const [timeDiffRows] = await pool.query(`SELECT GREATEST(1, TIMESTAMPDIFF(SECOND, started_at, NOW())) as dur FROM telephony_calls WHERE id = ?`, [callId]);
        const duration = timeDiffRows[0] ? timeDiffRows[0].dur : 1;

        await pool.query(`
            UPDATE telephony_calls
            SET technical_status = 'COMPLETED',
                ended_at = NOW(),
                duration_seconds = GREATEST(duration_seconds, ?),
                talk_time_seconds = GREATEST(talk_time_seconds, ?),
                hangup_reason = 'Call terminated by user (Hang Up / Cancel button clicked)'
            WHERE id = ?
        `, [duration, duration, callId]);

        return { success: true, message: "Call terminated successfully", provider_result: hangupResult };
    }
}

module.exports = TelephonyService;

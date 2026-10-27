const pool = require('../config/db');
const whatsappService = require('./whatsapp.service');
const notificationService = require('./notification.service');
const deliveryNotifier = require('../utils/deliveryNotifier');
const axios = require('axios');

/**
 * Chatbot Flow Execution Engine
 */
class FlowEngine {
    /**
     * Waits for Meta double-tick (delivered / read) event before proceeding downstream
     */
    static async waitForMediaDelivery(sendRes) {
        try {
            const metaMsgId = sendRes?.messages?.[0]?.id;
            if (!metaMsgId) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                return;
            }

            console.log(`[FlowEngine] Waiting for Meta delivery confirmation for msg ${metaMsgId}...`);
            await new Promise((resolve) => {
                let timeoutId;
                const onDelivered = (status) => {
                    clearTimeout(timeoutId);
                    console.log(`[FlowEngine] Delivery (${status}) CONFIRMED for msg ${metaMsgId}! Proceeding to next node...`);
                    resolve();
                };

                deliveryNotifier.once(`delivered:${metaMsgId}`, onDelivered);

                // Fallback timeout (max 3.5s) so downstream nodes (Product cards) execute quickly
                timeoutId = setTimeout(() => {
                    deliveryNotifier.removeListener(`delivered:${metaMsgId}`, onDelivered);
                    console.log(`[FlowEngine] Delivery wait timeout (3.5s) reached for ${metaMsgId}. Proceeding to next node...`);
                    resolve();
                }, 3500);
            });
        } catch (e) {
            console.error('[FlowEngine] waitForMediaDelivery error:', e.message);
        }
    }
    /**
     * Helper to trigger human handoff, update lead status to 'human_needed', and dispatch notifications
     */
    static async triggerHumanTakeover(sessionOrPhone, reason = 'Human takeover requested') {
        try {
            let phone = typeof sessionOrPhone === 'string' ? sessionOrPhone : sessionOrPhone.phone;
            let sessionId = typeof sessionOrPhone === 'object' ? sessionOrPhone.session_id : null;
            let leadId = typeof sessionOrPhone === 'object' ? sessionOrPhone.lead_id : null;

            const phoneTenDigits = (phone || '').replace(/\D/g, '').slice(-10);
            const isCallSupport = Boolean(reason && (reason.toLowerCase().includes('call support') || reason.toLowerCase().includes('callback')));

            // Update chatbot session state
            if (sessionId) {
                if (typeof sessionOrPhone === 'object') {
                    sessionOrPhone.variables = sessionOrPhone.variables || {};
                    if (isCallSupport) {
                        sessionOrPhone.variables.is_call_support = true;
                        sessionOrPhone.variables.call_support_requested = true;
                        sessionOrPhone.variables.handoff_reason = 'Call Support';
                    } else {
                        delete sessionOrPhone.variables.is_call_support;
                        delete sessionOrPhone.variables.call_support_requested;
                        sessionOrPhone.variables.handoff_reason = reason;
                    }
                    await pool.query('UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW(), variables = ? WHERE session_id = ?', [JSON.stringify(sessionOrPhone.variables), sessionId]);
                } else {
                    await pool.query('UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW() WHERE session_id = ?', [sessionId]);
                }
            } else {
                await pool.query(
                    'UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW() WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "active"',
                    [phone, phoneTenDigits, `%${phoneTenDigits}`]
                );
            }

            // Get lead information & update lead status to 'human_needed'
            let customerName = 'WhatsApp Lead';
            const notifType = isCallSupport ? 'call_support' : 'human_takeover';
            const notifTitle = isCallSupport ? '📞 Customer Requested Call Support' : '🚨 Human Assistance Needed';

            if (leadId) {
                await pool.query('UPDATE leads SET status = "human_needed" WHERE lead_id = ?', [leadId]);
                const [[leadRow]] = await pool.query('SELECT customer_name, assigned_to FROM leads WHERE lead_id = ?', [leadId]);
                if (leadRow) {
                    if (leadRow.customer_name) customerName = leadRow.customer_name;
                    if (leadRow.assigned_to) {
                        await notificationService.sendToUser(
                            leadRow.assigned_to,
                            notifTitle,
                            `Lead ${customerName} (${phone}) requested ${isCallSupport ? 'Call Support' : 'human takeover'}: ${reason}`,
                            { phone, type: notifType, sessionId: String(sessionId || '') }
                        ).catch(err => console.error('[FCM ERROR]', err.message));
                    }
                }
            } else {
                await pool.query('UPDATE leads SET status = "human_needed" WHERE phone_number LIKE ?', [`%${phoneTenDigits}`]);
                const [[leadRow]] = await pool.query('SELECT lead_id, customer_name, assigned_to FROM leads WHERE phone_number LIKE ? LIMIT 1', [`%${phoneTenDigits}`]);
                if (leadRow) {
                    if (leadRow.customer_name) customerName = leadRow.customer_name;
                    if (leadRow.assigned_to) {
                        await notificationService.sendToUser(
                            leadRow.assigned_to,
                            notifTitle,
                            `Lead ${customerName} (${phone}) requested ${isCallSupport ? 'Call Support' : 'human takeover'}: ${reason}`,
                            { phone, type: notifType, sessionId: String(sessionId || '') }
                        ).catch(err => console.error('[FCM ERROR]', err.message));
                    }
                }
            }

            // Send FCM push alerts to admin and whatsapp_manager roles
            await notificationService.sendToRole('admin', notifTitle, `Lead ${customerName} (${phone}) requested ${isCallSupport ? 'Call Support' : 'human takeover'}: ${reason}`, { phone, type: notifType }).catch(() => {});
            await notificationService.sendToRole('whatsapp_manager', notifTitle, `Lead ${customerName} (${phone}) requested ${isCallSupport ? 'Call Support' : 'human takeover'}: ${reason}`, { phone, type: notifType }).catch(() => {});

            // Send WhatsApp handoff notice to customer
            await whatsappService.sendMessage(phone, 'Connecting you to a representative. Please wait, a salesperson will contact you shortly.', null, -1);
            console.log(`[FlowEngine] Triggered Human Handoff for ${phone} (Reason: ${reason}) - Lead Status updated to 'human_needed'`);
        } catch (err) {
            console.error('[FlowEngine] Error in triggerHumanTakeover:', err);
        }
    }

    /**
     * Entry point: processes incoming messages for a phone number
     */
    static async handleMessage(phone, messageText, mediaUrl = null, mediaDetails = {}) {
        console.log(`[FlowEngine] Received message from ${phone}: "${messageText}"`);
        const cleanedText = (messageText || '').trim().toLowerCase();
        const phoneTenDigits = (phone || '').replace(/\D/g, '').slice(-10);

        // Global Reset Keywords (restart, reset, menu, main menu, 0)
        const globalResetKeywords = ['restart', 'reset', 'start over', 'menu', 'main menu', '0'];
        const isResetKeyword = globalResetKeywords.includes(cleanedText);

        // Auto-expire stale active sessions older than 15 minutes
        await pool.query(
            'SELECT session_id FROM chatbot_sessions WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "active" AND last_activity_at < NOW() - INTERVAL 15 MINUTE',
            [phone, phoneTenDigits, `%${phoneTenDigits}`]
        ).then(async ([staleRows]) => {
            if (staleRows.length > 0) {
                await pool.query(
                    'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW() WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "active" AND last_activity_at < NOW() - INTERVAL 15 MINUTE',
                    [phone, phoneTenDigits, `%${phoneTenDigits}`]
                );
            }
        }).catch(() => {});

        // Fetch ALL ACTIVE flows containing a Start node trigger configuration
        const [flows] = await pool.query(`
            SELECT f.flow_id, f.active_version_id, f.name, f.status, n.config 
            FROM chatbot_flows f 
            JOIN chatbot_nodes n ON f.active_version_id = n.version_id 
            WHERE f.status = "active" AND f.active_version_id IS NOT NULL AND n.node_type = "start"
        `);

        // Check if incoming message matches an explicit Flow Trigger Keyword or Campaign Tagline (STRICT EXACT MATCH ONLY)
        let matchedFlow = null;
        if (cleanedText) {
            for (const f of flows) {
                const config = typeof f.config === 'string' ? JSON.parse(f.config) : f.config;
                if (config) {
                    // Collect all valid trigger strings from both keywords and campaignTagline
                    const triggerList = [];
                    if (config.keywords) {
                        triggerList.push(...String(config.keywords).split(/,|\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
                    }
                    if (config.campaignTagline) {
                        triggerList.push(...String(config.campaignTagline).split(/,|\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
                    }

                    if (triggerList.length > 0) {
                        // Strict exact match: incoming message must equal any keyword or campaign tagline
                        if (triggerList.some(w => cleanedText === w)) {
                            // Check if this tagline/keyword is linked to a Campaign in the database
                            const campaignSearch = config.campaignTagline || config.campaignId || '';
                            const [campaignRows] = await pool.query(
                                'SELECT id, status, campaign_id, tag_line FROM campaigns WHERE LOWER(TRIM(tag_line)) = LOWER(TRIM(?)) OR LOWER(TRIM(tag_line)) = LOWER(TRIM(?)) OR campaign_id = ?',
                                [campaignSearch, cleanedText, config.campaignId || '']
                            );

                            let isCampaignFlow = false;
                            if (campaignRows.length > 0) {
                                const activeCampaign = campaignRows.find(c => (c.status || '').toLowerCase() === 'active');
                                if (!activeCampaign) {
                                    console.log(`[FlowEngine] Tagline exact-matched Campaign "${campaignRows[0].campaign_id}", but Campaign status is "${campaignRows[0].status}". Both Campaign AND Flow MUST be active! Skipping flow execution.`);
                                    continue; // Skip flow because campaign is inactive
                                }
                                isCampaignFlow = true;
                            }

                            matchedFlow = f;
                            matchedFlow.is_campaign = isCampaignFlow;
                            break;
                        }
                    }
                }
            }
        }

        // 1. Locate active session (status = 'active')
        const [activeSessionRows] = await pool.query(
            'SELECT * FROM chatbot_sessions WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "active" ORDER BY session_id DESC LIMIT 1',
            [phone, phoneTenDigits, `%${phoneTenDigits}`]
        );

        let session = null;
        if (activeSessionRows.length > 0) {
            session = activeSessionRows[0];
            session.variables = typeof session.variables === 'string' ? JSON.parse(session.variables) : (session.variables || {});
        }

        // 2. Check if session is currently paused for human takeover
        const [pausedSessionRows] = await pool.query(
            'SELECT * FROM chatbot_sessions WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "paused_for_human" ORDER BY session_id DESC LIMIT 1',
            [phone, phoneTenDigits, `%${phoneTenDigits}`]
        );
        const hasPausedSession = pausedSessionRows.length > 0;

        // If global reset keyword OR explicit trigger keyword matched:
        // Close any existing active OR paused_for_human session and allow starting a fresh flow!
        if ((isResetKeyword || matchedFlow) && (session || hasPausedSession)) {
            console.log(`[FlowEngine] Reset / Trigger keyword "${messageText}" received. Resetting old session to start fresh flow.`);
            await pool.query(
                'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW() WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND (status = "active" OR status = "paused_for_human")',
                [phone, phoneTenDigits, `%${phoneTenDigits}`]
            );
            session = null;
        } else if (hasPausedSession && !isResetKeyword) {
            // Paused for human takeover and NOT resetting -> ignore bot execution
            console.log(`[FlowEngine] Session for ${phone} is currently paused for human takeover. Ignoring message.`);
            return;
        }

        // 3. If no active session, trigger flow execution ONLY if keyword/tagline matched
        if (!session) {
            // Check human escape keywords (agent, human, support, representative, talk to human)
            const humanEscapes = ['agent', 'human', 'support', 'representative', 'talk to human', 'help me'];
            if (humanEscapes.some(h => cleanedText.includes(h))) {
                await this.triggerHumanTakeover(phone, 'Customer typed human escape keyword');
                return;
            }

            if (matchedFlow) {
                console.log(`[FlowEngine] Starting Flow ID ${matchedFlow.flow_id} for ${phone}...`);
                const initialVars = { first_message: messageText };
                if (matchedFlow.is_campaign) initialVars.is_campaign = true;

                const [sessionResult] = await pool.query(
                    'INSERT INTO chatbot_sessions (flow_id, version_id, phone, current_node_key, status, variables) VALUES (?, ?, ?, ?, ?, ?)',
                    [matchedFlow.flow_id, matchedFlow.active_version_id, phone, 'node-start', 'active', JSON.stringify(initialVars)]
                );

                // Load newly created session
                const [newSessionRows] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [sessionResult.insertId]);
                session = newSessionRows[0];
                session.variables = typeof session.variables === 'string' ? JSON.parse(session.variables) : (session.variables || {});

                // Log start node execution
                await this.logExecution(session.session_id, 'node-start', 'enter', messageText, 'Start Node Triggered');

                // Move from Start node to its connected target node
                const [edgeRows] = await pool.query(
                    'SELECT target_node_key FROM chatbot_edges WHERE version_id = ? AND source_node_key = "node-start" LIMIT 1',
                    [session.version_id]
                );

                let nextKey = edgeRows.length > 0 ? edgeRows[0].target_node_key : null;

                // Validate that nextKey exists in chatbot_nodes
                if (nextKey) {
                    const [chkNode] = await pool.query(
                        'SELECT node_key FROM chatbot_nodes WHERE version_id = ? AND node_key = ? LIMIT 1',
                        [session.version_id, nextKey]
                    );
                    if (chkNode.length === 0) {
                        console.warn(`[FlowEngine] Start node edge points to non-existent node "${nextKey}". Falling back to start node config.nextNode.`);
                        nextKey = null;
                    }
                }

                // Fallback to startNode config.nextNode
                if (!nextKey) {
                    const [startNodes] = await pool.query(
                        'SELECT config FROM chatbot_nodes WHERE version_id = ? AND node_key = "node-start" LIMIT 1',
                        [session.version_id]
                    );
                    if (startNodes.length > 0) {
                        const sCfg = typeof startNodes[0].config === 'string' ? JSON.parse(startNodes[0].config) : startNodes[0].config;
                        if (sCfg && sCfg.nextNode) {
                            nextKey = sCfg.nextNode;
                        }
                    }
                }

                if (nextKey) {
                    session.current_node_key = nextKey;
                    await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', 
                        [session.current_node_key, JSON.stringify(session.variables), session.session_id]);
                    await this.executeFlowLoop(session);
                    return;
                } else {
                    // Start has no connections, end execution
                    await pool.query('UPDATE chatbot_sessions SET status = "completed", completed_at = NOW() WHERE session_id = ?', [session.session_id]);
                    return;
                }
            } else {
                console.log(`[FlowEngine] No active flow available for "${messageText}". Skipping.`);
                return;
            }
        }

        // 3. Process current node state (expecting user input reply)
        const [nodeRows] = await pool.query(
            'SELECT * FROM chatbot_nodes WHERE version_id = ? AND node_key = ? LIMIT 1',
            [session.version_id, session.current_node_key]
        );

        if (nodeRows.length === 0) {
            console.error(`[FlowEngine] Current node ${session.current_node_key} not found for version ${session.version_id}`);
            return;
        }

        const currentNode = nodeRows[0];
        const config = typeof currentNode.config === 'string' ? JSON.parse(currentNode.config) : currentNode.config;

        let inputAccepted = false;
        let nextNodeKey = null;
        let answerValue = messageText;

        // Global check for human escape during active node prompt (unless current node explicitly offers a matching button/choice)
        const isChoiceNode = ['question', 'buttons', 'list', 'contact_time'].includes(currentNode.node_type);
        const rawChoicesForCheck = isChoiceNode ? (config.choices || config.slots || (config.options ? config.options.map(o => o.label || o.value) : [])) : [];
        const hasMatchingChoice = rawChoicesForCheck.some(c => {
            const str = typeof c === 'string' ? c : (c.label || c.value || '');
            const sLower = str.toLowerCase().trim();
            return sLower === cleanedText || cleanedText.includes(sLower) || sLower.includes(cleanedText);
        });

        const humanEscapes = ['agent', 'human', 'representative', 'talk to human'];
        if (!hasMatchingChoice && (humanEscapes.some(h => cleanedText.includes(h)) || cleanedText === 'support')) {
            await this.triggerHumanTakeover(session, 'Customer requested human support mid-prompt');
            return;
        }

        if (['question', 'buttons', 'list', 'contact_time'].includes(currentNode.node_type)) {
            const rawChoices = config.choices || config.slots || (config.options ? config.options.map(o => o.label || o.value) : []);
            const options = rawChoices.map((item, idx) => {
                const labelStr = typeof item === 'string' ? item : (item.label || item.title || `Option ${idx + 1}`);
                const valStr = typeof item === 'string' ? item : (item.value || labelStr);
                return { label: labelStr, value: valStr, index: idx };
            });

            // 1. Exact match / 1-based index match / option id / truncated title match
            let matchedOption = options.find((opt, idx) => {
                const l = opt.label.trim().toLowerCase();
                const v = opt.value.trim().toLowerCase();
                const truncatedL = l.substring(0, 20).trim();
                return l === cleanedText || 
                       v === cleanedText ||
                       truncatedL === cleanedText ||
                       cleanedText === String(idx + 1) ||
                       cleanedText === `opt-${idx}`;
            });

            // 2. Intelligent Fuzzy / Substring match if exact match fails
            if (!matchedOption) {
                matchedOption = options.find(opt => {
                    const l = opt.label.toLowerCase();
                    const v = opt.value.toLowerCase();
                    const truncatedL = l.substring(0, 20).trim();
                    return l.includes(cleanedText) || 
                           cleanedText.includes(l.replace(/^\d+[\.\s]*/, '')) || 
                           v.includes(cleanedText) ||
                           (truncatedL && (cleanedText.includes(truncatedL) || truncatedL.includes(cleanedText)));
                });
            }
            
            if (matchedOption) {
                inputAccepted = true;
                answerValue = matchedOption.value;
                // Reset retry counter on valid input
                delete session.variables._retry_count;
                
                // Find next node from choice edge source_handle or index port or option config
                const sourcePortId = `port-${session.current_node_key}-out-${matchedOption.index}`;
                const trimmedLabel = (matchedOption.label || '').trim();
                const trimmedVal = (matchedOption.value || '').trim();

                const [edgeRows] = await pool.query(
                    'SELECT target_node_key FROM chatbot_edges WHERE version_id = ? AND source_node_key = ? AND (TRIM(source_handle) = ? OR TRIM(source_handle) = ? OR source_handle = ? OR source_handle IS NULL) ORDER BY (source_handle IS NOT NULL AND TRIM(source_handle) IN (?, ?)) DESC, id ASC LIMIT 1',
                    [session.version_id, session.current_node_key, trimmedLabel, trimmedVal, sourcePortId, trimmedLabel, trimmedVal]
                );

                if (edgeRows.length > 0) {
                    nextNodeKey = edgeRows[0].target_node_key;
                } else if (config.options && config.options[matchedOption.index] && config.options[matchedOption.index].nextNode) {
                    nextNodeKey = config.options[matchedOption.index].nextNode;
                } else {
                    // Fallback to simple output edge
                    const [simpleEdge] = await pool.query(
                        'SELECT target_node_key FROM chatbot_edges WHERE version_id = ? AND source_node_key = ? ORDER BY id ASC LIMIT 1',
                        [session.version_id, session.current_node_key]
                    );
                    if (simpleEdge.length > 0) nextNodeKey = simpleEdge[0].target_node_key;
                }

                // Save variable response
                const saveVar = config.saveTo || config.saveResponseTo;
                if (saveVar) {
                    session.variables[saveVar] = answerValue;
                }
                const isCallSupportOption = String(answerValue).toLowerCase().includes('call support') ||
                                            String(matchedOption.label || '').toLowerCase().includes('call support');
                if (isCallSupportOption) {
                    session.variables.is_call_support = true;
                    session.variables.call_support_requested = true;
                    session.variables.handoff_reason = 'Call Support';
                } else {
                    delete session.variables.is_call_support;
                    delete session.variables.call_support_requested;
                    if (session.variables.handoff_reason === 'Call Support') {
                        delete session.variables.handoff_reason;
                    }
                }
            } else {
                // Track retry attempts
                const retryCount = (session.variables._retry_count || 0) + 1;
                session.variables._retry_count = retryCount;
                delete session.variables.is_call_support;
                delete session.variables.call_support_requested;
                session.variables.handoff_reason = 'Unrecognized choice (2 invalid attempts)';
                await pool.query('UPDATE chatbot_sessions SET variables = ? WHERE session_id = ?', [JSON.stringify(session.variables), session.session_id]);

                if (retryCount >= 2) {
                    // 2nd Fallback: Auto handoff after 2 failed attempts
                    await this.triggerHumanTakeover(session, 'Unrecognized choice (2 invalid attempts)');
                    return;
                } else {
                    // 1st Fallback: Prompt again with guidance text and re-trigger prompt
                    await whatsappService.sendMessage(phone, '⚠️ I didn\'t quite get that response. Please select from the options below to continue:', null, -1);
                    await this.sendNodePrompt(phone, currentNode, config);
                    return;
                }
            }
        } else if (currentNode.node_type === 'text_input') {
            const rawVal = (messageText || '').trim();
            const valType = config.validationType || 'text';
            const targetVarKey = config.saveResponseTo || config.saveTo || '';
            const isNameField = valType === 'name' || ['name', 'name_place', 'customer_name'].includes(String(targetVarKey).toLowerCase());

            if (isNameField || valType === 'name') {
                // Pure numbers or phone numbers are NOT allowed as a customer name
                const isPureNumbers = /^\d+$/.test(rawVal);
                const isPhoneNumber = rawVal.replace(/\D/g, '').length >= 7 && !/[a-zA-Z\u0900-\u097F\u0C80-\u0CFF]/.test(rawVal);

                if (isPureNumbers || isPhoneNumber) {
                    await whatsappService.sendMessage(phone, "⚠️ Please enter a valid name (e.g. Ramesh, Bangalore). Pure numbers/phone numbers are not allowed as a customer name.", null, -1);
                    return;
                }
            } else if (valType === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(rawVal)) {
                    await whatsappService.sendMessage(phone, "Please enter a valid email address.", null, -1);
                    return;
                }
            } else if (valType === 'phone') {
                const phoneDigits = rawVal.replace(/\D/g, '');
                if (phoneDigits.length < 7) {
                    await whatsappService.sendMessage(phone, "Please enter a valid phone number.", null, -1);
                    return;
                }
            }
            // For 'text' or default: numbers, digits, letters, spaces and symbols are all fully allowed

            if (config.minLength && rawVal.length < parseInt(config.minLength)) {
                await whatsappService.sendMessage(phone, `Input must be at least ${config.minLength} characters.`, null, -1);
                return;
            }

            inputAccepted = true;
            answerValue = messageText;
            
            // Save response to CRM variable
            if (targetVarKey) {
                session.variables[targetVarKey] = answerValue;
            }

            // Find next node from edges
            nextNodeKey = await this.getNextTargetNodeKey(session.version_id, session.current_node_key, config);
        } else if (currentNode.node_type === 'number_input') {
            const parsedNum = parseFloat(messageText);
            if (!isNaN(parsedNum)) {
                inputAccepted = true;
                answerValue = parsedNum;

                if (config.saveResponseTo) {
                    session.variables[config.saveResponseTo] = answerValue;
                }

                nextNodeKey = await this.getNextTargetNodeKey(session.version_id, session.current_node_key, config);
            } else {
                await whatsappService.sendMessage(phone, "Please enter a valid numeric value.", null, -1);
                return;
            }
        } else if (currentNode.node_type === 'message' && config.inputType === 'image') {
            // Media message collector
            if (mediaUrl) {
                inputAccepted = true;
                answerValue = mediaUrl;
                session.variables['image_media_url'] = mediaUrl;

                nextNodeKey = await this.getNextTargetNodeKey(session.version_id, session.current_node_key, config);
            } else {
                await whatsappService.sendMessage(phone, "Please attach a photo/image file to continue.", null, -1);
                return;
            }
        } else if (currentNode.node_type === 'form') {
            // Reusable Form Node input processing
            const formResult = await this.handleFormNodeInput(session, currentNode, config, messageText, phone, mediaDetails);
            if (!formResult.success) {
                await whatsappService.sendMessage(phone, formResult.message, null, -1);
                return;
            }
            inputAccepted = true;
            answerValue = formResult.summary;
            nextNodeKey = await this.getNextTargetNodeKey(session.version_id, session.current_node_key, config);
        } else if (currentNode.node_type === 'wait_for_media') {
            // Reusable Wait for Media / Evidence Capture Node processing
            const mediaResult = await this.handleWaitForMediaInput(session, currentNode, config, messageText, mediaUrl, mediaDetails, phone);
            if (!mediaResult.success) {
                await whatsappService.sendMessage(phone, mediaResult.message, null, -1);
                return;
            }
            inputAccepted = true;
            answerValue = mediaResult.summary;
            nextNodeKey = await this.getNextTargetNodeKey(session.version_id, session.current_node_key, config);
        }

        if (inputAccepted && nextNodeKey) {
            await this.logExecution(session.session_id, session.current_node_key, 'exit', messageText, `User provided: ${answerValue}`);
            
            // Move session state
            session.current_node_key = nextNodeKey;
            await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', 
                [session.current_node_key, JSON.stringify(session.variables), session.session_id]);

            // Execute downstream flow loop sequentially for ALL connected nodes
            await this.executeFlowLoop(session);
        }
    }

    /**
     * Helper to get the next target node key from config or edges
     */
    static async getNextTargetNodeKey(versionId, currentKey, config = {}) {
        // 1. Primary: Query visual edge connections from chatbot_edges table (excluding self-referencing loops)
        const [edgeRows] = await pool.query(
            'SELECT target_node_key FROM chatbot_edges WHERE version_id = ? AND source_node_key = ? AND target_node_key != ? ORDER BY id ASC LIMIT 1',
            [versionId, currentKey, currentKey]
        );
        if (edgeRows.length > 0) {
            return edgeRows[0].target_node_key;
        }

        // 2. Fallback: Return config.nextNode if no valid edge connection exists and it is not self-referencing
        if (config && config.nextNode && config.nextNode !== currentKey) {
            return config.nextNode;
        }

        return null;
    }

    /**
     * Helper to format text variables like {{name}} or {{land_acres}}
     */
    static formatTextVariables(text, variables = {}) {
        if (!text) return '';
        let result = String(text);
        if (!variables) return result;
        for (const [key, val] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            result = result.replace(regex, val !== null && val !== undefined ? String(val) : '');
        }
        return result;
    }

    /**
     * Executes downstream flow nodes sequentially until user input is required
     */
    static async executeFlowLoop(session) {
        let executionLimit = 25; // Prevent infinite loops
        let currentKey = session.current_node_key;
        const visitedNodes = new Set();

        while (executionLimit > 0 && currentKey) {
            if (visitedNodes.has(currentKey)) {
                console.warn(`[FlowEngine] ⚠️ Cycle detected! Node ${currentKey} was already visited in this execution pass. Breaking loop.`);
                break;
            }
            visitedNodes.add(currentKey);

            executionLimit--;

            const [nodeRows] = await pool.query(
                'SELECT * FROM chatbot_nodes WHERE version_id = ? AND node_key = ? LIMIT 1',
                [session.version_id, currentKey]
            );

            if (nodeRows.length === 0) {
                console.error(`[FlowEngine] Next node key ${currentKey} not found!`);
                break;
            }

            const node = nodeRows[0];
            const config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
            const botSenderId = -1; // Chatbot flow messages belong to Chatbot (-1)

            console.log(`[FlowEngine] Executing Node [${node.node_type}] -> "${node.name}" (${node.node_key})`);
            await this.logExecution(session.session_id, node.node_key, 'enter', null, `Executing ${node.name}`);

            if (node.node_type === 'start') {
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'message' && !config.inputType) {
                const msgText = this.formatTextVariables(config.message || '', session.variables);
                if (msgText) {
                    await whatsappService.sendMessage(session.phone, msgText, null, botSenderId);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'image') {
                try {
                    const imgUrl = config.mediaUrl || config.image_url || config.file_url || '';
                    const caption = this.formatTextVariables(config.caption || config.message || '', session.variables);
                    if (imgUrl) {
                        const sendRes = await whatsappService.sendMediaMessage(session.phone, imgUrl, 'image', caption, null, botSenderId);
                        await this.waitForMediaDelivery(sendRes);
                    } else if (caption) {
                        await whatsappService.sendMessage(session.phone, caption, null, botSenderId);
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing Image node ${currentKey}:`, err.message);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'video') {
                try {
                    const videoUrl = config.mediaUrl || config.video_url || config.file_url || '';
                    const caption = this.formatTextVariables(config.caption || config.message || '', session.variables);
                    if (videoUrl) {
                        try {
                            const sendRes = await whatsappService.sendMediaMessage(session.phone, videoUrl, 'video', caption, null, botSenderId);
                            await this.waitForMediaDelivery(sendRes);
                        } catch (videoErr) {
                            console.warn(`[FlowEngine] Native video send failed for node ${currentKey} (${videoErr.message}). Falling back to sending video link text message...`);
                            const fallbackMsg = caption ? `${caption}\n\n🎥 *Watch Video:* ${videoUrl}` : `🎥 *Watch Video:* ${videoUrl}`;
                            await whatsappService.sendMessage(session.phone, fallbackMsg, null, botSenderId);
                        }
                    } else if (caption) {
                        await whatsappService.sendMessage(session.phone, caption, null, botSenderId);
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing Video node ${currentKey}:`, err.message);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'media' || node.node_type === 'document' || node.node_type === 'audio') {
                try {
                    const mediaUrl = config.mediaUrl || config.file_url || '';
                    const type = node.node_type === 'audio' ? 'audio' : 'document';
                    const caption = this.formatTextVariables(config.caption || config.filename || '', session.variables);
                    if (mediaUrl) {
                        const sendRes = await whatsappService.sendMediaMessage(session.phone, mediaUrl, type, caption, null, botSenderId);
                        await this.waitForMediaDelivery(sendRes);
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing Media node ${currentKey}:`, err.message);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'multi_media') {
                try {
                    const items = config.mediaItems || [];
                    const caption = this.formatTextVariables(config.caption || '', session.variables);
                    for (let i = 0; i < items.length; i++) {
                        const itemUrl = items[i];
                        if (itemUrl) {
                            const sendRes = await whatsappService.sendMediaMessage(session.phone, itemUrl, 'image', i === 0 ? caption : '', null, botSenderId);
                            await this.waitForMediaDelivery(sendRes);
                        }
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing MultiMedia node ${currentKey}:`, err.message);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'product') {
                try {
                    let productName = config.product || config.name || '';
                    let description = config.desc || config.description || '';
                    let imageUrl = config.image || config.image_url || '';

                    let priceText = config.price || (config.amount ? `₹${config.amount}` : '');

                    // Look up catalog details ONLY if fields are missing
                    let catRows = [];
                    if (config.productId) {
                        [catRows] = await pool.query('SELECT name, price, description, image_url FROM chatbot_products WHERE id = ?', [config.productId]);
                    }
                    if (catRows.length === 0 && productName) {
                        [catRows] = await pool.query('SELECT name, price, description, image_url FROM chatbot_products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [productName]);
                    }
                    if (catRows.length > 0) {
                        productName = productName || catRows[0].name;
                        priceText = priceText || (catRows[0].price ? `₹${parseFloat(catRows[0].price).toLocaleString('en-IN')}` : '');
                        description = description || catRows[0].description;
                        // ONLY use catalog image_url if node config image is completely empty
                        if (!imageUrl && catRows[0].image_url) {
                            imageUrl = catRows[0].image_url;
                        }
                    }

                    productName = productName || node.name || 'Product Details';

                    // Format professional product card text
                    let cardText = `📦 *${productName}*`;
                    if (priceText && config.showPrice !== false && config.show_price !== false) {
                        const formattedPrice = String(priceText).startsWith('₹') ? priceText : `₹${priceText}`;
                        cardText += `\n💰 *Price:* ${formattedPrice}`;
                    }
                    if (description && description.trim()) {
                        let cleanDesc = description.trim();
                        if (priceText && config.showPrice !== false && config.show_price !== false) {
                            cleanDesc = cleanDesc.replace(/\s*Price:\s*₹?\d+[\d,.]*\.?/gi, '').trim();
                        }
                        if (cleanDesc) {
                            cardText += `\n\n${cleanDesc}`;
                        }
                    }

                    if (imageUrl) {
                        try {
                            const sendRes = await whatsappService.sendMediaMessage(session.phone, imageUrl, 'image', cardText, null, botSenderId);
                            await this.waitForMediaDelivery(sendRes);
                        } catch (mediaErr) {
                            console.warn(`[FlowEngine] Image send failed for Product node ${currentKey}, falling back to text:`, mediaErr.message);
                            await whatsappService.sendMessage(session.phone, cardText, null, botSenderId);
                        }
                    } else {
                        await whatsappService.sendMessage(session.phone, cardText, null, botSenderId);
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing Product node ${currentKey}:`, err.message);
                }

                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'delay' || node.node_type === 'time_trigger') {
                const durationVal = parseFloat(config.delayValue || config.delaySeconds || config.duration) || 5;
                const unitStr = (config.delayUnit || config.unit || 'seconds').toLowerCase();
                let delayMs = durationVal * 1000;
                if (unitStr.startsWith('min')) delayMs = durationVal * 60 * 1000;
                else if (unitStr.startsWith('hour')) delayMs = durationVal * 3600 * 1000;

                console.log(`[FlowEngine] ⏱️ Time Trigger / Delay Node (${node.node_key}): Pausing execution for ${durationVal} ${unitStr} (${delayMs}ms)...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'goto') {
                currentKey = config.targetNodeId || await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'save_lead_field') {
                if (config.field && config.value) {
                    session.variables[config.field] = this.formatTextVariables(config.value, session.variables);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'create_lead') {
                const [leadRows] = await pool.query('SELECT lead_id, customer_name, first_message FROM leads WHERE phone_number = ? LIMIT 1', [session.phone]);
                
                let leadId;
                const variables = session.variables || {};
                const mappings = config.fieldMappings || {};

                // Map customer name
                const nameKey = mappings.name || config.nameVar || 'name_place';
                const customerName = variables[nameKey] || variables.name_place || variables.name || 'WhatsApp Contact';

                const isPureNumName = /^\d+$/.test(customerName) || (customerName.replace(/\D/g, '').length >= 7 && !/[a-zA-Z\u0900-\u097F\u0C80-\u0CFF]/.test(customerName));

                // Always strictly preserve the original campaign / trigger message, never overwrite with Q&A responses
                const initialTriggerMessage = variables.first_message || session.first_message || 'WhatsApp Lead';
                const status = config.status || 'new';
                const source = config.source || 'WhatsApp Chatbot';

                let finalCustomerName = customerName;
                if (isPureNumName || customerName === 'WhatsApp Contact') {
                    if (leadRows.length > 0 && leadRows[0].customer_name && !/^\d+$/.test(leadRows[0].customer_name)) {
                        finalCustomerName = leadRows[0].customer_name;
                    } else {
                        finalCustomerName = 'WhatsApp Lead';
                    }
                }

                // Retrieve flow start node language for CRM lead assignment
                const [startNodeRows] = await pool.query(
                    'SELECT config FROM chatbot_nodes WHERE version_id = ? AND node_type = "start" LIMIT 1',
                    [session.version_id]
                );
                let flowLang = null;
                if (startNodeRows.length > 0) {
                    const startCfg = typeof startNodeRows[0].config === 'string' ? JSON.parse(startNodeRows[0].config) : startNodeRows[0].config;
                    if (startCfg && startCfg.language && startCfg.language !== 'None') {
                        flowLang = startCfg.language;
                    }
                }

                if (leadRows.length === 0) {
                    const [result] = await pool.query(
                        'INSERT INTO leads (customer_name, phone_number, first_message, source, status, language) VALUES (?, ?, ?, ?, ?, ?)',
                        [finalCustomerName, session.phone, initialTriggerMessage, source, status, flowLang]
                    );
                    leadId = result.insertId;
                    console.log(`[FlowEngine] Created Lead ID ${leadId} ("${finalCustomerName}", Lang: ${flowLang || 'Unassigned'}) in CRM Lead Management.`);
                } else {
                    leadId = leadRows[0].lead_id;
                    // Preserve existing first_message unless empty or containing legacy Q&A summary strings
                    const existingMsg = leadRows[0].first_message;
                    const cleanFirstMsg = (existingMsg && !existingMsg.startsWith('Product:') && !existingMsg.startsWith('Land Size:'))
                        ? existingMsg
                        : initialTriggerMessage;

                    await pool.query(
                        'UPDATE leads SET customer_name = ?, first_message = ?, status = ?, language = COALESCE(?, language) WHERE lead_id = ?',
                        [finalCustomerName, cleanFirstMsg, status, flowLang, leadId]
                    );
                    console.log(`[FlowEngine] Updated Lead ID ${leadId} ("${finalCustomerName}", Lang: ${flowLang || 'Unassigned'}) in CRM Lead Management.`);
                }

                // Support Call / Callback Task handling
                if (config.actionType === 'callback_task' || config.reason === 'Call Support') {
                    const callbackRemarks = `Callback Request: ${config.reason || 'Call Support'} for ${config.product || 'SGB Blade Protector'} via WhatsApp Chatbot`;
                    await pool.query(
                        'INSERT INTO lead_followups (lead_id, followup_date, status, remarks, created_by) VALUES (?, NOW(), "pending", ?, NULL)',
                        [leadId, callbackRemarks]
                    ).catch(err => console.error('[CALLBACK TASK INSERT ERROR]', err.message));

                    // Route to Human Handoff with Call Support flags
                    session.variables = session.variables || {};
                    session.variables.is_call_support = true;
                    session.variables.call_support_requested = true;
                    session.variables.call_support_product = config.product || 'SGB Blade Protector';
                    session.variables.call_support_requested_at = new Date().toISOString();
                    session.variables.handoff_reason = 'Call Support';
                    session.status = 'paused_for_human';
                    session.paused_at = new Date();

                    await pool.query(
                        'UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW(), variables = ? WHERE session_id = ?',
                        [JSON.stringify(session.variables), session.session_id]
                    );
                    await pool.query(
                        'UPDATE leads SET status = "human_needed" WHERE lead_id = ?',
                        [leadId]
                    );

                    // Immediately alert admin & staff
                    const notifTitle = '📞 Customer Requested Call Support';
                    const notifMsg = `Customer ${finalCustomerName} (${session.phone}) requested Call Support for ${config.product || 'SGB Blade Protector'}. Handoff active.`;
                    await pool.query(
                        'INSERT INTO notifications (lead_id, type, message, recipient_phone, status, sent_at) VALUES (?, "call_support", ?, ?, "sent", NOW())',
                        [leadId, notifMsg, session.phone]
                    ).catch(() => {});

                    await notificationService.sendToRole('admin', notifTitle, notifMsg, {
                        phone: session.phone,
                        customerName: finalCustomerName,
                        product: config.product || 'SGB Blade Protector',
                        type: 'call_support',
                        sessionId: String(session.session_id),
                        leadId: String(leadId)
                    }).catch(() => {});
                    await notificationService.sendToRole('whatsapp_manager', notifTitle, notifMsg, {
                        phone: session.phone,
                        customerName: finalCustomerName,
                        product: config.product || 'SGB Blade Protector',
                        type: 'call_support',
                        sessionId: String(session.session_id),
                        leadId: String(leadId)
                    }).catch(() => {});
                }

                session.lead_id = leadId;
                await pool.query('UPDATE chatbot_sessions SET lead_id = ?, variables = ? WHERE session_id = ?', 
                    [leadId, JSON.stringify(session.variables), session.session_id]);

                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'human_handoff') {
                await this.triggerHumanTakeover(session, 'Flow reached Human Handoff Node');
                return;
            }
            else if (node.node_type === 'webhook') {
                if (config.webhookUrl) {
                    try {
                        await axios.post(config.webhookUrl, {
                            phone: session.phone,
                            variables: session.variables
                        });
                    } catch (err) {
                        console.error('[FlowEngine] Webhook call failed:', err.message);
                    }
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'condition') {
                const varName = config.variable || config.saveResponseTo || 'land_acres';
                const operand = session.variables[varName];
                const rules = config.options || [];
                
                let matchedNextNode = null;
                for (const r of rules) {
                    const val = parseFloat(operand);
                    let passed = false;

                    if (r.label === 'Below 2 Acre' || r.value === 'below_2_acre' || r.value === 'below_2') {
                        passed = val < 2;
                    } else if (r.label === '2 - 5 Acre' || r.value === '2_5_acre' || r.value === 'between_2_5') {
                        passed = val >= 2 && val <= 5;
                    } else if (r.label === 'More than 5 Acre' || r.value === 'more_5_acre' || r.value === 'above_5') {
                        passed = val > 5;
                    } else {
                        passed = String(operand).trim().toLowerCase() === String(r.value || r.label).trim().toLowerCase();
                    }

                    if (passed) {
                        matchedNextNode = r.nextNode;
                        break;
                    }
                }

                if (!matchedNextNode) {
                    currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
                } else {
                    currentKey = matchedNextNode;
                }
            } 
            else if (node.node_type === 'payment' || node.node_type === 'qr_code') {
                try {
                    const payableAmount = config.amount || 600;
                    session.variables.payable_amount = payableAmount;
                    session.variables.payment_status = 'pending_verification';
                    session.variables.order_product = config.productName || 'SGB Blade Protector';

                    let paymentMsg = config.message || `Thank you, Sir!\n\nYour SGB Blade Protector delivery details have been saved.\n\nAmount to pay: ₹{{payable_amount}}\n\nPlease scan the official payment QR code below to complete your payment.\n\nAfter completing the payment, please send your payment screenshot here on WhatsApp.\n\nOur team will verify your payment and process your order.`;
                    paymentMsg = this.formatTextVariables(paymentMsg, session.variables);

                    // Dynamically use uploaded QR code image from node config (never hardcoded)
                    const qrUrl = config.qrImageUrl || config.qr_image_url || config.mediaUrl || config.image || config.image_url || config.file_url || '';
                    if (qrUrl) {
                        const sendRes = await whatsappService.sendMediaMessage(session.phone, qrUrl, 'image', paymentMsg, null, botSenderId);
                        await this.waitForMediaDelivery(sendRes);
                    } else {
                        await whatsappService.sendMessage(session.phone, paymentMsg, null, botSenderId);
                    }
                } catch (err) {
                    console.error(`[FlowEngine] Error executing Payment node ${currentKey}:`, err.message);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'form') {
                await this.sendFormPrompt(session.phone, node, config, session);
                await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', [currentKey, JSON.stringify(session.variables), session.session_id]);
                await this.syncLeadFromChatbotSession(session);
                return;
            }
            else if (node.node_type === 'wait_for_media') {
                const instructions = config.instructions || "Please complete the payment and send the payment screenshot here on WhatsApp.\n\nOur team will verify the payment and confirm your order.";
                const formattedInstructions = this.formatTextVariables(instructions, session.variables);
                // If the previous node in this execution cycle was already the Payment QR card with full instructions, avoid duplicate text
                const wasPaymentExecuted = Array.from(visitedNodes).some(k => k.includes('payment') || k.includes('qr'));
                if (!wasPaymentExecuted && formattedInstructions) {
                    await whatsappService.sendMessage(session.phone, formattedInstructions, null, botSenderId);
                }
                await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', [currentKey, JSON.stringify(session.variables), session.session_id]);
                await this.syncLeadFromChatbotSession(session);
                return;
            }
            else if (node.node_type === 'question' || node.node_type === 'buttons' || node.node_type === 'list' || node.node_type === 'contact_time' || node.node_type === 'text_input' || node.node_type === 'number_input' || (node.node_type === 'message' && config.inputType === 'image')) {
                // Interactive Node: Send prompt question / options and stop execution loop, pausing at this node waiting for user response
                await this.sendNodePrompt(session.phone, node, config, session);
                const newStatus = session.status || 'active';
                const pausedAtVal = newStatus === 'paused_for_human' ? (session.paused_at || new Date()) : null;
                await pool.query(
                    'UPDATE chatbot_sessions SET status = ?, paused_at = ?, current_node_key = ?, variables = ? WHERE session_id = ?', 
                    [newStatus, pausedAtVal, currentKey, JSON.stringify(session.variables), session.session_id]
                );
                await this.syncLeadFromChatbotSession(session);
                return;
            } 
            else if (node.node_type === 'end') {
                const finalMsg = this.formatTextVariables(config.message || 'Thank you! Our sales team will contact you soon.', session.variables);
                await whatsappService.sendMessage(session.phone, finalMsg, null, botSenderId);

                const isCallSupportEnd = Boolean(
                    session.status === 'paused_for_human' || 
                    session.variables?.is_call_support || 
                    currentKey === 'node-support-ack'
                );
                const endStatus = isCallSupportEnd ? 'paused_for_human' : 'completed';
                await pool.query(
                    'UPDATE chatbot_sessions SET status = ?, current_node_key = ?, variables = ?, paused_at = CASE WHEN ? = "paused_for_human" THEN COALESCE(paused_at, NOW()) ELSE paused_at END, completed_at = CASE WHEN ? = "completed" THEN NOW() ELSE completed_at END WHERE session_id = ?', 
                    [endStatus, currentKey, JSON.stringify(session.variables), endStatus, endStatus, session.session_id]
                );
                await this.syncLeadFromChatbotSession(session);
                return;
            } 
            else {
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }

            // Sync node transition position
            if (currentKey) {
                await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', [currentKey, JSON.stringify(session.variables), session.session_id]);
                await this.syncLeadFromChatbotSession(session);
            }
        }
    }

    /**
     * Helper to send corresponding interactive menu prompts
     */
    static async sendNodePrompt(phone, node, config, session = null) {
        const botSenderId = -1; // Chatbot flow prompts belong to Chatbot (-1)
        if (['question', 'buttons', 'list', 'contact_time'].includes(node.node_type)) {
            const rawChoices = config.choices || config.slots || (config.options ? config.options.map(o => o.label || o.value) : []);
            const choices = rawChoices.map((item, idx) => typeof item === 'string' ? item : (item.label || item.title || `Option ${idx + 1}`));
            const rawPrompt = config.question || config.message || 'Please select an option:';
            const promptText = this.formatTextVariables(rawPrompt, session ? session.variables : {});
            
            try {
                if ((node.node_type === 'buttons' || config.responseType === 'buttons' || (choices.length > 0 && choices.length <= 3)) && choices.length > 0 && choices.length <= 3) {
                    const buttons = choices.map((choice, idx) => ({ id: `opt-${idx}`, title: choice }));
                    await whatsappService.sendButtons(phone, promptText, buttons, botSenderId);
                } else if ((node.node_type === 'list' || config.responseType === 'list' || choices.length > 3) && choices.length > 0 && choices.length <= 10) {
                    const listItems = choices.map((choice, idx) => ({ id: `opt-${idx}`, title: choice }));
                    await whatsappService.sendList(phone, promptText, config.buttonText || 'Select Option', listItems, botSenderId);
                } else if (choices.length > 0) {
                    let menuText = `${promptText}\n\n`;
                    choices.forEach((c, idx) => {
                        menuText += `${idx + 1}. ${c}\n`;
                    });
                    await whatsappService.sendMessage(phone, menuText, null, botSenderId);
                } else {
                    await whatsappService.sendMessage(phone, promptText, null, botSenderId);
                }
            } catch (err) {
                console.error(`[FlowEngine] Failed to send interactive buttons/list for node ${node.node_key}, falling back to plain text menu:`, err.message);
                if (choices && choices.length > 0) {
                    let menuText = `${promptText}\n\n`;
                    choices.forEach((c, idx) => {
                        menuText += `${idx + 1}. ${c}\n`;
                    });
                    await whatsappService.sendMessage(phone, menuText, null, botSenderId);
                } else {
                    await whatsappService.sendMessage(phone, promptText, null, botSenderId);
                }
            }
        } else if (node.node_type === 'text_input' || node.node_type === 'number_input') {
            const rawPrompt = config.question || config.message || 'Please enter details:';
            const promptText = this.formatTextVariables(rawPrompt, session ? session.variables : {});
            await whatsappService.sendMessage(phone, promptText, null, botSenderId);
        } else if (node.node_type === 'message' && config.inputType === 'image') {
            const promptText = this.formatTextVariables(config.message || '', session ? session.variables : {});
            await whatsappService.sendMessage(phone, promptText, null, botSenderId);
        }
    }

    /**
     * Logs node transition steps in chatbot_executions table
     */
    static async logExecution(sessionId, nodeKey, eventType, input, output, status = 'success', error = null) {
        try {
            await pool.query(
                'INSERT INTO chatbot_executions (session_id, node_key, event_type, input, output, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [sessionId, nodeKey, eventType, input, output, status, error]
            );
        } catch (err) {
            console.error('[LOG EXECUTION ERROR]', err);
        }
    }

    /**
     * Syncs chatbot variables & progression score directly into the leads table
     */
    static async syncLeadFromChatbotSession(session) {
        if (!session || (!session.phone && !session.lead_id)) return;
        try {
            const vars = typeof session.variables === 'string' ? JSON.parse(session.variables) : (session.variables || {});
            const keys = Object.keys(vars).filter(k => !k.startsWith('_') && k !== 'first_message');
            const answeredCount = keys.length;

            let score = 'cold';
            if (answeredCount >= 4) {
                score = 'hot';
            } else if (answeredCount >= 2) {
                score = 'warm';
            }

            const phoneTen = (session.phone || '').replace(/\D/g, '').slice(-10);

            let leadId = session.lead_id;
            if (!leadId && phoneTen) {
                const [[matchedLead]] = await pool.query('SELECT lead_id FROM leads WHERE phone_number LIKE ? LIMIT 1', [`%${phoneTen}`]);
                if (matchedLead) leadId = matchedLead.lead_id;
            }

            if (leadId) {
                // Update score in database
                await pool.query('UPDATE leads SET score = ? WHERE lead_id = ?', [score, leadId]);

                // Sync Name & Location if captured in chatbot (disallow pure numbers as customer_name)
                const capturedNamePlace = vars.name_place || vars.name || vars.customer_name;
                if (capturedNamePlace) {
                    const parts = String(capturedNamePlace).split(',').map(s => s.trim());
                    const potentialName = parts[0];
                    const isPureNumbers = /^\d+$/.test(potentialName);
                    if (potentialName && !isPureNumbers) {
                        await pool.query('UPDATE leads SET customer_name = ? WHERE lead_id = ?', [potentialName, leadId]);
                    }
                    if (parts[1]) {
                        await pool.query('UPDATE leads SET city = COALESCE(NULLIF(city, ""), ?) WHERE lead_id = ?', [parts[1], leadId]);
                    }
                }
            }
        } catch (err) {
            console.error('[FlowEngine] Error syncing lead from chatbot session:', err);
        }
    }

    /**
     * Re-triggers a chatbot flow session for a customer (from telecaller action)
     */
    static async retriggerSession(sessionIdOrPhone) {
        let session = null;
        const isNum = !isNaN(sessionIdOrPhone) && Number.isInteger(Number(sessionIdOrPhone));
        if (isNum) {
            const [rows] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [sessionIdOrPhone]);
            if (rows.length > 0) session = rows[0];
        }
        if (!session) {
            const phoneTen = String(sessionIdOrPhone).replace(/\D/g, '').slice(-10);
            const [rows] = await pool.query('SELECT * FROM chatbot_sessions WHERE (phone = ? OR phone = ? OR phone LIKE ?) ORDER BY session_id DESC LIMIT 1', [sessionIdOrPhone, phoneTen, `%${phoneTen}`]);
            if (rows.length > 0) session = rows[0];
        }
        if (!session) {
            throw new Error('Chatbot session not found for specified identifier');
        }

        session.variables = typeof session.variables === 'string' ? JSON.parse(session.variables) : (session.variables || {});
        delete session.variables._retry_count;

        // Reset status to active
        await pool.query('UPDATE chatbot_sessions SET status = "active", paused_at = NULL, variables = ? WHERE session_id = ?', [JSON.stringify(session.variables), session.session_id]);
        
        // Reset lead status from human_needed back to new or assigned
        if (session.lead_id) {
            await pool.query('UPDATE leads SET status = CASE WHEN status = "human_needed" THEN "new" ELSE status END WHERE lead_id = ?', [session.lead_id]);
        }

        // Fetch current node to re-trigger prompt
        const [nodeRows] = await pool.query('SELECT * FROM chatbot_nodes WHERE version_id = ? AND node_key = ? LIMIT 1', [session.version_id, session.current_node_key]);
        if (nodeRows.length > 0) {
            const node = nodeRows[0];
            const config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
            await whatsappService.sendMessage(session.phone, '🔄 Chatbot flow resumed. Please continue:', null, -1);
            await this.sendNodePrompt(session.phone, node, config);
        }
        return { success: true, sessionId: session.session_id, current_node_key: session.current_node_key };
    }

    /**
     * Pauses bot flow execution for manual telecaller takeover
     */
    static async takeoverSession(sessionIdOrPhone) {
        let session = null;
        const isNum = !isNaN(sessionIdOrPhone) && Number.isInteger(Number(sessionIdOrPhone));
        if (isNum) {
            const [rows] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [sessionIdOrPhone]);
            if (rows.length > 0) session = rows[0];
        }
        if (!session) {
            const phoneTen = String(sessionIdOrPhone).replace(/\D/g, '').slice(-10);
            const [rows] = await pool.query('SELECT * FROM chatbot_sessions WHERE (phone = ? OR phone = ? OR phone LIKE ?) ORDER BY session_id DESC LIMIT 1', [sessionIdOrPhone, phoneTen, `%${phoneTen}`]);
            if (rows.length > 0) session = rows[0];
        }
        if (!session) {
            throw new Error('Chatbot session not found for specified identifier');
        }

        await this.triggerHumanTakeover(session, 'Manual telecaller takeover from CRM');
        return { success: true, sessionId: session.session_id };
    }

    /**
     * Resolves human handoff status for a customer/session
     */
    static async resolveHandoff(sessionIdOrPhone) {
        const phoneTen = String(sessionIdOrPhone).replace(/\D/g, '').slice(-10);

        // Reset paused chatbot sessions for this phone/session
        await pool.query(
            'UPDATE chatbot_sessions SET status = "completed", paused_at = NULL WHERE status = "paused_for_human" AND (session_id = ? OR phone = ? OR phone LIKE ?)',
            [sessionIdOrPhone, sessionIdOrPhone, `%${phoneTen}`]
        );

        // Reset lead status from human_needed back to assigned/new
        await pool.query(
            'UPDATE leads SET status = CASE WHEN status = "human_needed" THEN IF(assigned_to IS NOT NULL, "assigned", "new") ELSE status END WHERE (lead_id = ? OR phone_number LIKE ?)',
            [sessionIdOrPhone, `%${phoneTen}`]
        );

        return { success: true, message: 'Handoff resolved successfully' };
    }

    /**
     * Silently completes any active chatbot session when an agent sends a manual message
     * (Stops bot execution without triggering Human Handoff / NEEDS HUMAN flags)
     */
    static async pauseSessionForAgent(sessionIdOrPhone) {
        const phoneTen = String(sessionIdOrPhone).replace(/\D/g, '').slice(-10);

        try {
            const [result] = await pool.query(
                'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW() WHERE status = "active" AND (session_id = ? OR phone = ? OR phone LIKE ?)',
                [sessionIdOrPhone, sessionIdOrPhone, `%${phoneTen}`]
            );
            if (result.affectedRows > 0) {
                console.log(`[FlowEngine] Chatbot session for ${sessionIdOrPhone} silently completed due to manual agent reply.`);
            }
            return { success: true, completedCount: result.affectedRows };
        } catch (err) {
            console.error('[FlowEngine] Error in pauseSessionForAgent:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Helper to send form prompt instructions via Native WhatsApp Flow
     */
    static async sendFormPrompt(phone, node, config, session) {
        const botSenderId = -1;
        const flowId = config.flowId || config.flow_id || process.env.META_FLOW_ID || '1471575221542737';

        try {
            await whatsappService.sendFlow(
                phone,
                config.title || 'Blade Protector Order',
                config.description || 'Please tap below to fill your delivery details inside WhatsApp.',
                config.submitButtonLabel || config.buttonText || 'Fill Delivery Details',
                flowId,
                'DELIVERY_DETAILS',
                `flow_token_${session?.session_id || Date.now()}`,
                botSenderId
            );
            console.log(`[FlowEngine] Native WhatsApp Flow (${flowId}) sent to ${phone}.`);
        } catch (flowErr) {
            console.warn(`[FlowEngine] Native WhatsApp Flow send failed (${flowErr.message}), falling back to text prompt:`);
            const formPrompt = `📋 *${config.title || 'Blade Protector Delivery Details'}*\n\n${config.description || 'Please enter your delivery details.'}\n\nPlease reply with:\n1. *Full Name*\n2. *Delivery Address* (House no, Street, Village/Town)\n3. *PIN Code* (6 digits)\n4. *Confirmation*: Type "Yes" to confirm details are correct\n\n_Example:_\nRamesh Kumar\nNear Temple, Main Road, Kunigal, Tumkur\n572130\nYes`;
            await whatsappService.sendMessage(phone, formPrompt, null, botSenderId);
        }
    }

    /**
     * Handles customer responses at the Form Node
     */
    static async handleFormNodeInput(session, currentNode, config, messageText, phone, mediaDetails = {}) {
        const raw = (messageText || '').trim();
        const vars = session.variables || {};

        let extractedName = null;
        let extractedAddr = null;
        let extractedPin = null;
        let extractedConfirm = false;

        // Check if data came directly from Meta WhatsApp Flow submission
        if (mediaDetails?.flowData) {
            extractedName = (mediaDetails.flowData.customer_name || '').trim();
            extractedAddr = (mediaDetails.flowData.delivery_address || '').trim();
            extractedPin = (mediaDetails.flowData.pincode || '').toString().trim();
            extractedConfirm = true;
        }

        const pinMatch = raw.match(/\b[1-9][0-9]{5}\b/);
        const hasConfirmWord = /(?:yes|confirm|confirmed|correct|ok|ha|sari|true|1)\b/i.test(raw);

        // Check if message is multi-line or labeled
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        
        const nameMatch = raw.match(/(?:name|full\s*name|hesaru)\s*[:=-]\s*([^\n,]+)/i);
        const addrMatch = raw.match(/(?:address|delivery\s*address|ooru|vilasa)\s*[:=-]\s*([^\n]+)/i);

        if (!extractedName) extractedName = nameMatch ? nameMatch[1].trim() : null;
        if (!extractedAddr) extractedAddr = addrMatch ? addrMatch[1].trim() : null;
        if (!extractedPin) extractedPin = pinMatch ? pinMatch[0] : null;
        if (!extractedConfirm) extractedConfirm = hasConfirmWord;

        if (!extractedName && lines.length >= 2) {
            const candidateName = lines[0].replace(/^(?:1[.)]|\-)\s*/, '').trim();
            if (!/^\d+$/.test(candidateName) && candidateName.length >= 2) {
                extractedName = candidateName;
            }
        }

        if (!extractedAddr && lines.length >= 3) {
            const middleLines = lines.slice(1).filter(l => !l.match(/\b[1-9][0-9]{5}\b/) && !/^(?:yes|confirm|ok|1)$/i.test(l));
            if (middleLines.length > 0) {
                extractedAddr = middleLines.join(', ');
            }
        }

        // Single message complete submission
        if (extractedName && extractedAddr && extractedPin && extractedConfirm) {
            vars.customer_name = extractedName;
            vars.delivery_address = extractedAddr;
            vars.pincode = extractedPin;
            vars.address_confirmed = 'Yes';
            vars.form_submitted_at = new Date().toISOString();

            if (session.lead_id) {
                await pool.query('UPDATE leads SET customer_name = ?, address = ?, pincode = ? WHERE lead_id = ?', [extractedName, extractedAddr, extractedPin, session.lead_id]).catch(() => {});
            } else {
                const phoneTen = phone.replace(/\D/g, '').slice(-10);
                await pool.query('UPDATE leads SET customer_name = ?, address = ?, pincode = ? WHERE phone_number LIKE ?', [extractedName, extractedAddr, extractedPin, `%${phoneTen}`]).catch(() => {});
            }

            return {
                success: true,
                summary: `${extractedName}, ${extractedAddr}, ${extractedPin}`
            };
        }

        // Sequential step fallback if not all supplied in one message:
        if (!vars.customer_name) {
            if (/^\d+$/.test(raw) || raw.replace(/\D/g, '').length >= 7) {
                return {
                    success: false,
                    message: "⚠️ Please enter a valid customer name (pure numbers or phone numbers are not allowed as name)."
                };
            }
            if (raw.length < 2) {
                return {
                    success: false,
                    message: "⚠️ Please enter your Full Name:"
                };
            }
            vars.customer_name = raw;
            await pool.query('UPDATE chatbot_sessions SET variables = ? WHERE session_id = ?', [JSON.stringify(vars), session.session_id]);
            return {
                success: false,
                message: `Thank you, Sir! Name saved: *${raw}*.\n\nPlease now enter your complete *Delivery Address* (House no, Street, Village/Town):`
            };
        } else if (!vars.delivery_address) {
            if (raw.length < 5) {
                return {
                    success: false,
                    message: "⚠️ Please enter a complete Delivery Address (House no, Street, Village/Town, Locality):"
                };
            }
            if (pinMatch) {
                vars.pincode = pinMatch[0];
                vars.delivery_address = raw.replace(pinMatch[0], '').replace(/,\s*$/, '').trim();
            } else {
                vars.delivery_address = raw;
            }
            await pool.query('UPDATE chatbot_sessions SET variables = ? WHERE session_id = ?', [JSON.stringify(vars), session.session_id]);

            if (vars.pincode) {
                return {
                    success: false,
                    message: `Address saved: *${vars.delivery_address}*\nPIN Code: *${vars.pincode}*\n\nPlease reply *'Yes'* to confirm: "I confirm that my name, delivery address and PIN code are correct."`
                };
            } else {
                return {
                    success: false,
                    message: `Delivery Address saved.\n\nPlease enter your *6-digit PIN Code* (e.g. 560001):`
                };
            }
        } else if (!vars.pincode) {
            if (!/^\d{6}$/.test(raw)) {
                return {
                    success: false,
                    message: "⚠️ Invalid PIN code! PIN code must be exactly 6 digits (e.g. 572130). Please enter a valid 6-digit PIN code:"
                };
            }
            vars.pincode = raw;
            await pool.query('UPDATE chatbot_sessions SET variables = ? WHERE session_id = ?', [JSON.stringify(vars), session.session_id]);
            return {
                success: false,
                message: `PIN code saved: *${raw}*.\n\nPlease reply *'Yes'* to confirm: "I confirm that my name, delivery address and PIN code are correct."`
            };
        } else {
            const isConfirmed = /(?:yes|confirm|confirmed|correct|ok|ha|sari|true|1)\b/i.test(raw);
            if (isConfirmed) {
                vars.address_confirmed = 'Yes';
                vars.form_submitted_at = new Date().toISOString();

                if (session.lead_id) {
                    await pool.query('UPDATE leads SET customer_name = ?, address = ?, pincode = ? WHERE lead_id = ?', [vars.customer_name, vars.delivery_address, vars.pincode, session.lead_id]).catch(() => {});
                } else {
                    const phoneTen = phone.replace(/\D/g, '').slice(-10);
                    await pool.query('UPDATE leads SET customer_name = ?, address = ?, pincode = ? WHERE phone_number LIKE ?', [vars.customer_name, vars.delivery_address, vars.pincode, `%${phoneTen}`]).catch(() => {});
                }

                return {
                    success: true,
                    summary: `${vars.customer_name}, ${vars.delivery_address}, ${vars.pincode}`
                };
            } else {
                return {
                    success: false,
                    message: `Please reply *'Yes'* to confirm your delivery details, or type your address again to edit it.`
                };
            }
        }
    }

    /**
     * Handles customer responses at the Wait for Media / Screenshot Capture Node
     */
    static async handleWaitForMediaInput(session, currentNode, config, messageText, mediaUrl, mediaDetails = {}, phone) {
        const isMedia = Boolean(
            mediaUrl ||
            (mediaDetails && ['image', 'document'].includes(mediaDetails.msgType)) ||
            (typeof messageText === 'string' && (messageText.startsWith('http://') || messageText.startsWith('https://') || messageText.includes('/api/media/')))
        );

        if (!isMedia) {
            const reminder = config.reminderText || "⚠️ Please complete the payment and send the payment screenshot here on WhatsApp.\n\nOur team will verify the payment and confirm your order.";
            return {
                success: false,
                message: reminder
            };
        }

        const evidenceUrl = mediaUrl || (typeof messageText === 'string' && messageText.startsWith('http') ? messageText : '/api/media/received_evidence');
        const vars = session.variables || {};
        vars.payment_screenshot_url = evidenceUrl;
        vars.payment_evidence_timestamp = new Date().toISOString();
        vars.payment_verification_status = 'pending_verification';
        vars.payment_status = 'pending_verification';
        vars.needs_payment_verification = true;

        const customerName = vars.customer_name || 'WhatsApp Customer';
        const deliveryAddress = vars.delivery_address || 'Address provided';
        const pincode = vars.pincode || 'PIN provided';
        const payableAmount = vars.payable_amount || config.amount || 600;

        let orderId = null;
        try {
            const [existingOrders] = await pool.query(
                'SELECT order_id FROM orders WHERE (lead_id = ? OR phone = ?) AND total_amount = ? ORDER BY order_id DESC LIMIT 1',
                [session.lead_id || 0, phone, payableAmount]
            );

            if (existingOrders.length > 0) {
                orderId = existingOrders[0].order_id;
                await pool.query(
                    'UPDATE orders SET order_status = "in_review", customer_name = COALESCE(?, customer_name), address = COALESCE(?, address), pincode = COALESCE(?, pincode), updated_at = NOW() WHERE order_id = ?',
                    [customerName, deliveryAddress, pincode, orderId]
                );
            } else {
                const [ordRes] = await pool.query(
                    'INSERT INTO orders (order_source, purchase_source, lead_id, customer_name, phone, address, pincode, total_amount, balance_amount, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    ['lead', 'whatsapp_chatbot', session.lead_id || null, customerName, phone, deliveryAddress, pincode, payableAmount, payableAmount, 'in_review']
                );
                orderId = ordRes.insertId;
                await pool.query(
                    'INSERT INTO order_items (order_id, product_name, quantity, price, total_amount) VALUES (?, ?, ?, ?, ?)',
                    [orderId, config.product || 'SGB Blade Protector', 1, payableAmount, payableAmount]
                ).catch(() => {});
            }
            vars.order_id = orderId;
            vars.payment_status = 'pending_verification';
            vars.payment_verification_status = 'pending_verification';
            vars.needs_payment_verification = true;

            const phoneTen = phone.replace(/\D/g, '').slice(-10);
            await pool.query(
                'UPDATE leads SET last_message = "🖼️ Payment screenshot received" WHERE lead_id = ? OR phone_number LIKE ?',
                [session.lead_id || 0, `%${phoneTen}`]
            ).catch(() => {});
        } catch (ordErr) {
            console.error('[FlowEngine] Error recording order for evidence receipt:', ordErr.message);
        }

        // Trigger Admin Notifications
        try {
            const notifTitle = 'Blade Protector — Payment Screenshot Received';
            const notifMsg = `Customer: ${customerName} (${phone})\nProduct: ${config.product || 'SGB Blade Protector'} (₹${payableAmount})\nAddress: ${deliveryAddress}, PIN: ${pincode}\nOrder ID: #${orderId || 'N/A'}\nStatus: Payment Verification Pending\nEvidence: ${evidenceUrl}`;

            await pool.query(
                'INSERT INTO notifications (order_id, lead_id, type, message, recipient_phone, status, sent_at) VALUES (?, ?, "payment_evidence", ?, ?, "sent", NOW())',
                [orderId || null, session.lead_id || null, notifMsg, phone]
            ).catch(err => console.error('[NOTIFICATION INSERT ERROR]', err.message));

            await notificationService.sendToRole('admin', notifTitle, notifMsg, {
                phone,
                type: 'payment_screenshot',
                orderId: String(orderId || ''),
                sessionId: String(session.session_id)
            }).catch(() => {});

            await notificationService.sendToRole('whatsapp_manager', notifTitle, notifMsg, {
                phone,
                type: 'payment_screenshot',
                orderId: String(orderId || ''),
                sessionId: String(session.session_id)
            }).catch(() => {});
        } catch (notifErr) {
            console.error('[FlowEngine] Error sending admin notification for payment screenshot:', notifErr.message);
        }

        return {
            success: true,
            summary: `Screenshot received (${evidenceUrl})`
        };
    }
}

module.exports = FlowEngine;

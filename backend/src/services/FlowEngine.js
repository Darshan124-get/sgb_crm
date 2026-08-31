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
        const metaMsgId = sendRes?.messages?.[0]?.id;
        if (!metaMsgId) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return;
        }

        console.log(`[FlowEngine] Waiting for Meta double-tick (delivered/read) for msg ${metaMsgId}...`);
        await new Promise((resolve) => {
            let timeoutId;
            const onDelivered = (status) => {
                clearTimeout(timeoutId);
                console.log(`[FlowEngine] Double-tick (${status}) CONFIRMED for msg ${metaMsgId}! Proceeding to next node...`);
                resolve();
            };

            deliveryNotifier.once(`delivered:${metaMsgId}`, onDelivered);

            // Fallback timeout in case Webhook is delayed or recipient is offline (max 8 seconds)
            timeoutId = setTimeout(() => {
                deliveryNotifier.removeListener(`delivered:${metaMsgId}`, onDelivered);
                console.log(`[FlowEngine] Delivery wait fallback timeout (8s) reached for ${metaMsgId}. Proceeding...`);
                resolve();
            }, 8000);
        });
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

            // Update chatbot session state
            if (sessionId) {
                await pool.query('UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW() WHERE session_id = ?', [sessionId]);
            } else {
                await pool.query(
                    'UPDATE chatbot_sessions SET status = "paused_for_human", paused_at = NOW() WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND status = "active"',
                    [phone, phoneTenDigits, `%${phoneTenDigits}`]
                );
            }

            // Get lead information & update lead status to 'human_needed'
            let customerName = 'WhatsApp Lead';
            if (leadId) {
                await pool.query('UPDATE leads SET status = "human_needed" WHERE lead_id = ?', [leadId]);
                const [[leadRow]] = await pool.query('SELECT customer_name, assigned_to FROM leads WHERE lead_id = ?', [leadId]);
                if (leadRow) {
                    if (leadRow.customer_name) customerName = leadRow.customer_name;
                    if (leadRow.assigned_to) {
                        await notificationService.sendToUser(
                            leadRow.assigned_to,
                            '🚨 Human Assistance Needed',
                            `Lead ${customerName} (${phone}) requested human takeover: ${reason}`,
                            { phone, type: 'human_takeover', sessionId: String(sessionId || '') }
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
                            '🚨 Human Assistance Needed',
                            `Lead ${customerName} (${phone}) requested human takeover: ${reason}`,
                            { phone, type: 'human_takeover', sessionId: String(sessionId || '') }
                        ).catch(err => console.error('[FCM ERROR]', err.message));
                    }
                }
            }

            // Send FCM push alerts to admin and whatsapp_manager roles (assigned staff receives via sendToUser above)
            await notificationService.sendToRole('admin', '🚨 Human Assistance Needed', `Lead ${customerName} (${phone}) needs human takeover: ${reason}`, { phone, type: 'human_takeover' }).catch(() => {});
            await notificationService.sendToRole('whatsapp_manager', '🚨 Human Assistance Needed', `Lead ${customerName} (${phone}) needs human takeover: ${reason}`, { phone, type: 'human_takeover' }).catch(() => {});

            // Send WhatsApp handoff notice to customer
            await whatsappService.sendMessage(phone, 'Connecting you to a representative. Please wait, a salesperson will contact you shortly.');
            console.log(`[FlowEngine] Triggered Human Handoff for ${phone} (Reason: ${reason}) - Lead Status updated to 'human_needed'`);
        } catch (err) {
            console.error('[FlowEngine] Error in triggerHumanTakeover:', err);
        }
    }

    /**
     * Entry point: processes incoming messages for a phone number
     */
    static async handleMessage(phone, messageText, mediaUrl = null) {
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

        // Fetch all active flows containing a Start node trigger configuration
        const [flows] = await pool.query(`
            SELECT f.flow_id, f.active_version_id, n.config 
            FROM chatbot_flows f 
            JOIN chatbot_nodes n ON f.active_version_id = n.version_id 
            WHERE f.status = "active" AND n.node_type = "start"
        `);

        // Check if incoming message is an explicit Flow Trigger Keyword or Campaign Tagline
        let matchedFlow = null;
        if (cleanedText) {
            for (const f of flows) {
                const config = typeof f.config === 'string' ? JSON.parse(f.config) : f.config;
                if (config) {
                    const keywordStr = config.keywords || config.campaignTagline || '';
                    if (keywordStr) {
                        const words = keywordStr.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
                        if (words.some(w => cleanedText.includes(w) || w === cleanedText)) {
                            matchedFlow = f;
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

        // 3. If no active session, trigger flow execution
        if (!session) {
            // Check human escape keywords (agent, human, support, representative, talk to human)
            const humanEscapes = ['agent', 'human', 'support', 'representative', 'talk to human', 'help me'];
            if (humanEscapes.some(h => cleanedText.includes(h))) {
                await this.triggerHumanTakeover(phone, 'Customer typed human escape keyword');
                return;
            }

            // Fallback to active flow if no specific keyword matched
            if (!matchedFlow && flows.length > 0) {
                const defaultFlow = flows.find(f => {
                    const cfg = typeof f.config === 'string' ? JSON.parse(f.config) : f.config;
                    return cfg && (cfg.triggerType === 'Default' || !cfg.keywords);
                }) || flows[0];
                matchedFlow = defaultFlow;
            }

            if (matchedFlow) {
                console.log(`[FlowEngine] Starting Flow ID ${matchedFlow.flow_id} for ${phone}...`);
                const [sessionResult] = await pool.query(
                    'INSERT INTO chatbot_sessions (flow_id, version_id, phone, current_node_key, status, variables) VALUES (?, ?, ?, ?, ?, ?)',
                    [matchedFlow.flow_id, matchedFlow.active_version_id, phone, 'node-start', 'active', JSON.stringify({ first_message: messageText })]
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

                if (edgeRows.length > 0) {
                    session.current_node_key = edgeRows[0].target_node_key;
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

        // Global check for human escape during active node prompt
        const humanEscapes = ['agent', 'human', 'support', 'representative', 'talk to human'];
        if (humanEscapes.some(h => cleanedText.includes(h))) {
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

            // 1. Exact match / 1-based index match
            let matchedOption = options.find((opt, idx) => 
                opt.label.trim().toLowerCase() === cleanedText || 
                opt.value.trim().toLowerCase() === cleanedText ||
                cleanedText === String(idx + 1)
            );

            // 2. Intelligent Fuzzy / Substring match if exact match fails
            if (!matchedOption) {
                matchedOption = options.find(opt => {
                    const l = opt.label.toLowerCase();
                    const v = opt.value.toLowerCase();
                    return l.includes(cleanedText) || cleanedText.includes(l.replace(/^\d+[\.\s]*/, '')) || v.includes(cleanedText);
                });
            }
            
            if (matchedOption) {
                inputAccepted = true;
                answerValue = matchedOption.value;
                // Reset retry counter on valid input
                delete session.variables._retry_count;
                
                // Find next node from choice edge source_handle or index port or option config
                const sourcePortId = `port-${session.current_node_key}-out-${matchedOption.index}`;
                const [edgeRows] = await pool.query(
                    'SELECT target_node_key FROM chatbot_edges WHERE version_id = ? AND source_node_key = ? AND (source_handle = ? OR source_handle = ? OR source_handle = ? OR source_handle IS NULL) ORDER BY id ASC LIMIT 1',
                    [session.version_id, session.current_node_key, matchedOption.label, matchedOption.value, sourcePortId]
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
            } else {
                // Track retry attempts
                const retryCount = (session.variables._retry_count || 0) + 1;
                session.variables._retry_count = retryCount;
                await pool.query('UPDATE chatbot_sessions SET variables = ? WHERE session_id = ?', [JSON.stringify(session.variables), session.session_id]);

                if (retryCount >= 2) {
                    // 2nd Fallback: Auto handoff after 2 failed attempts
                    await this.triggerHumanTakeover(session, 'Unrecognized choice (2 invalid attempts)');
                    return;
                } else {
                    // 1st Fallback: Prompt again with guidance text and re-trigger prompt
                    await whatsappService.sendMessage(phone, '⚠️ I didn\'t quite get that response. Please select from the options below to continue:');
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
                    await whatsappService.sendMessage(phone, "⚠️ Please enter a valid name (e.g. Ramesh, Bangalore). Pure numbers/phone numbers are not allowed as a customer name.");
                    return;
                }
            } else if (valType === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(rawVal)) {
                    await whatsappService.sendMessage(phone, "Please enter a valid email address.");
                    return;
                }
            } else if (valType === 'phone') {
                const phoneDigits = rawVal.replace(/\D/g, '');
                if (phoneDigits.length < 7) {
                    await whatsappService.sendMessage(phone, "Please enter a valid phone number.");
                    return;
                }
            }
            // For 'text' or default: numbers, digits, letters, spaces and symbols are all fully allowed

            if (config.minLength && rawVal.length < parseInt(config.minLength)) {
                await whatsappService.sendMessage(phone, `Input must be at least ${config.minLength} characters.`);
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
                await whatsappService.sendMessage(phone, "Please enter a valid numeric value.");
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
                await whatsappService.sendMessage(phone, "Please attach a photo/image file to continue.");
                return;
            }
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

            console.log(`[FlowEngine] Executing Node [${node.node_type}] -> "${node.name}" (${node.node_key})`);
            await this.logExecution(session.session_id, node.node_key, 'enter', null, `Executing ${node.name}`);

            if (node.node_type === 'start') {
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'message' && !config.inputType) {
                const msgText = this.formatTextVariables(config.message || '', session.variables);
                if (msgText) {
                    await whatsappService.sendMessage(session.phone, msgText);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            } 
            else if (node.node_type === 'image') {
                const imgUrl = config.mediaUrl || config.image_url || config.file_url || '';
                const caption = this.formatTextVariables(config.caption || config.message || '', session.variables);
                if (imgUrl) {
                    const sendRes = await whatsappService.sendMediaMessage(session.phone, imgUrl, 'image', caption);
                    await this.waitForMediaDelivery(sendRes);
                } else if (caption) {
                    await whatsappService.sendMessage(session.phone, caption);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'video') {
                const videoUrl = config.mediaUrl || config.video_url || config.file_url || '';
                const caption = this.formatTextVariables(config.caption || config.message || '', session.variables);
                if (videoUrl) {
                    const sendRes = await whatsappService.sendMediaMessage(session.phone, videoUrl, 'video', caption);
                    await this.waitForMediaDelivery(sendRes);
                } else if (caption) {
                    await whatsappService.sendMessage(session.phone, caption);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'media' || node.node_type === 'document' || node.node_type === 'audio') {
                const mediaUrl = config.mediaUrl || config.file_url || '';
                const type = node.node_type === 'audio' ? 'audio' : 'document';
                const caption = this.formatTextVariables(config.caption || config.filename || '', session.variables);
                if (mediaUrl) {
                    const sendRes = await whatsappService.sendMediaMessage(session.phone, mediaUrl, type, caption);
                    await this.waitForMediaDelivery(sendRes);
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'multi_media') {
                const items = config.mediaItems || [];
                const caption = this.formatTextVariables(config.caption || '', session.variables);
                for (let i = 0; i < items.length; i++) {
                    const itemUrl = items[i];
                    if (itemUrl) {
                        const sendRes = await whatsappService.sendMediaMessage(session.phone, itemUrl, 'image', i === 0 ? caption : '');
                        await this.waitForMediaDelivery(sendRes);
                    }
                }
                currentKey = await this.getNextTargetNodeKey(session.version_id, currentKey, config);
            }
            else if (node.node_type === 'product') {
                let productName = config.product || config.name || '';
                let priceText = config.price || '';
                let description = config.desc || config.description || '';
                let imageUrl = config.image || config.image_url || '';

                if ((!productName || !priceText) && config.productId) {
                    const [catRows] = await pool.query('SELECT name, price, description, image_url FROM chatbot_products WHERE id = ?', [config.productId]);
                    if (catRows.length > 0) {
                        productName = productName || catRows[0].name;
                        priceText = priceText || `₹${parseFloat(catRows[0].price).toLocaleString('en-IN')}`;
                        description = description || catRows[0].description;
                        imageUrl = imageUrl || catRows[0].image_url;
                    } else {
                        const [prodRows] = await pool.query('SELECT name, selling_price, description, image_url FROM products WHERE product_id = ?', [config.productId]);
                        if (prodRows.length > 0) {
                            productName = productName || prodRows[0].name;
                            priceText = priceText || `₹${parseFloat(prodRows[0].selling_price).toLocaleString('en-IN')}`;
                            description = description || prodRows[0].description;
                            imageUrl = imageUrl || prodRows[0].image_url;
                        }
                    }
                }

                productName = productName || node.name || 'Product Details';
                const cardText = `📦 *${productName}*\n${priceText ? `Price: ${priceText}\n` : ''}\n${description || ''}`.trim();

                if (imageUrl) {
                    const sendRes = await whatsappService.sendMediaMessage(session.phone, imageUrl, 'image', cardText);
                    await this.waitForMediaDelivery(sendRes);
                } else {
                    await whatsappService.sendMessage(session.phone, cardText);
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
            else if (node.node_type === 'question' || node.node_type === 'buttons' || node.node_type === 'list' || node.node_type === 'contact_time' || node.node_type === 'text_input' || node.node_type === 'number_input' || (node.node_type === 'message' && config.inputType === 'image')) {
                // Interactive Node: Send prompt question / options and stop execution loop, pausing at this node waiting for user response
                await this.sendNodePrompt(session.phone, node, config);
                await pool.query('UPDATE chatbot_sessions SET current_node_key = ?, variables = ? WHERE session_id = ?', [currentKey, JSON.stringify(session.variables), session.session_id]);
                await this.syncLeadFromChatbotSession(session);
                return;
            } 
            else if (node.node_type === 'end') {
                const finalMsg = this.formatTextVariables(config.message || 'Thank you! Our sales team will contact you soon.', session.variables);
                await whatsappService.sendMessage(session.phone, finalMsg);
                await pool.query('UPDATE chatbot_sessions SET status = "completed", current_node_key = ?, variables = ?, completed_at = NOW() WHERE session_id = ?', 
                    [currentKey, JSON.stringify(session.variables), session.session_id]);
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
    static async sendNodePrompt(phone, node, config) {
        if (['question', 'buttons', 'list', 'contact_time'].includes(node.node_type)) {
            const rawChoices = config.choices || config.slots || (config.options ? config.options.map(o => o.label || o.value) : []);
            const choices = rawChoices.map((item, idx) => typeof item === 'string' ? item : (item.label || item.title || `Option ${idx + 1}`));
            const promptText = config.question || 'Please select an option:';
            
            if ((node.node_type === 'buttons' || config.responseType === 'buttons') && choices.length > 0 && choices.length <= 3) {
                const buttons = choices.map((choice, idx) => ({ id: `opt-${idx}`, title: choice }));
                await whatsappService.sendButtons(phone, promptText, buttons);
            } else if ((node.node_type === 'list' || config.responseType === 'list') && choices.length > 0) {
                const listItems = choices.map((choice, idx) => ({ id: `opt-${idx}`, title: choice }));
                await whatsappService.sendList(phone, promptText, config.buttonText || 'Select Option', listItems);
            } else if (choices.length > 0) {
                let menuText = `${promptText}\n\n`;
                choices.forEach((c, idx) => {
                    menuText += `${idx + 1}. ${c}\n`;
                });
                await whatsappService.sendMessage(phone, menuText);
            } else {
                await whatsappService.sendMessage(phone, promptText);
            }
        } else if (node.node_type === 'text_input' || node.node_type === 'number_input') {
            await whatsappService.sendMessage(phone, config.question || 'Please enter details:');
        } else if (node.node_type === 'message' && config.inputType === 'image') {
            await whatsappService.sendMessage(phone, config.message);
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
            await whatsappService.sendMessage(session.phone, '🔄 Chatbot flow resumed. Please continue:');
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
}

module.exports = FlowEngine;

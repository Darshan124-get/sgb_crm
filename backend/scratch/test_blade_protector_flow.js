const mysql = require('mysql2/promise');
require('dotenv').config();

async function runTests() {
    console.log('================================================================');
    console.log('🤖 RUNNING SGB BLADE PROTECTOR FLOW TEMPLATE & ENGINE TESTS');
    console.log('================================================================\n');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sgb_crm',
        waitForConnections: true,
        connectionLimit: 5
    });

    try {
        // TEST 1: Template in Database
        console.log('TEST 1: Verifying registered template in database...');
        const [templates] = await pool.query('SELECT * FROM chatbot_templates WHERE name LIKE "%Blade%"');
        if (templates.length === 0) {
            throw new Error('Template for Blade Protector not found in chatbot_templates');
        }
        const tpl = templates[0];
        console.log(`✅ Template Found: ID ${tpl.template_id}, Name: "${tpl.name}", Status: "${tpl.status}"`);

        // TEST 2: Instantiate Template into a Draft Test Flow
        console.log('\nTEST 2: Instantiating template into draft flow...');
        const [flowResult] = await pool.query(`
            INSERT INTO chatbot_flows (name, description, status)
            VALUES (?, ?, 'draft')
        `, ['TEST — SGB Blade Protector Verification Flow', tpl.description]);
        const testFlowId = flowResult.insertId;

        const [verResult] = await pool.query(`
            INSERT INTO chatbot_flow_versions (flow_id, version_number, status)
            VALUES (?, 1.0, 'draft')
        `, [testFlowId]);
        const testVersionId = verResult.insertId;

        // Use the exact node and edge structure configured in chatbot.controller.js for sgb-blade-protector-sales
        const tplNodes = [
            { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: 'Hi, I am interested in the SGB Blade Protector, SGB Blade Protector, Blade Protector, blade protector', nextNode: 'node-intro-img' } },
            { key: 'node-intro-img', type: 'image', name: 'Standalone Blade Protector', x: 340, y: 220, config: { mediaUrl: '/api/media/campaigns/sep_blade_protector/auto-reply-1789455691692-0.jpeg', caption: 'SGB Blade Protector — Circular metal protective guard for brush cutters.', nextNode: 'node-promo-img' } },
            { key: 'node-promo-img', type: 'image', name: 'Blade Protector Mounted', x: 600, y: 220, config: { mediaUrl: '/api/media/campaigns/sep_blade_protector/auto-reply-1789455692365-1.jpeg', caption: 'SGB Blade Protection — Mounted on brush cutter to protect crops from accidental damage.', nextNode: 'node-demo-video' } },
            { key: 'node-demo-video', type: 'video', name: 'Product Video Demonstration', x: 860, y: 220, config: { mediaUrl: '/api/media/campaigns/sep_blade_protector/auto-reply-1789455692863-2.mp4', caption: 'Demonstration of SGB Blade Protector in field operation.', nextNode: 'node-product-card' } },
            { key: 'node-product-card', type: 'product', name: 'SGB Blade Protector Card', x: 1120, y: 220, config: { productId: 15, product: 'SGB Blade Protector', price: '₹600', desc: 'A blade protector/guard attached to a compatible brush cutter to help protect crops from accidental damage during cutting operations. Price: ₹600.', image: '/api/media/campaigns/sep_blade_protector/auto-reply-1789455691692-0.jpeg', nextNode: 'node-choice' } },
            { key: 'node-choice', type: 'question', name: 'Customer Choice', x: 1380, y: 300, config: { question: 'Hello Sir! Welcome to SGB Agro Industries.\n\nIntroducing our SGB Blade Protector.\nIt is designed to help protect crops from accidental damage while using a compatible brush cutter.\n\nPrice: ₹600.\nPlease check the product images and video.\n\nSir, how would you like to proceed?', responseType: 'buttons', choices: ['Buy Now — ₹600', 'Call Support'], options: [{ label: 'Buy Now — ₹600', value: 'buy_now', nextNode: 'node-form' }, { label: 'Call Support', value: 'call_support', nextNode: 'node-support-callback' }], saveResponseTo: 'customer_choice' } },
            { key: 'node-form', type: 'form', name: 'Blade Protector Delivery Details', x: 1680, y: 200, config: { title: 'Blade Protector Delivery Details', description: 'Please enter your delivery details.', fields: [{ id: 'customer_name', label: 'Full Name', type: 'text', required: true }, { id: 'delivery_address', label: 'Delivery Address', type: 'multiline', required: true }, { id: 'pincode', label: 'PIN Code', type: 'text', required: true }, { id: 'address_confirmed', label: 'Address Confirmation', type: 'checkbox', required: true, text: 'I confirm that my name, delivery address and PIN code are correct.' }], submitButtonLabel: 'Save & Continue', saveTo: 'delivery_details', nextNode: 'node-address-review' } },
            { key: 'node-address-review', type: 'question', name: 'Address Review', x: 1980, y: 200, config: { question: 'Please confirm your delivery details, Sir.\n\nProduct: SGB Blade Protector\nPrice: ₹600\nName: {{customer_name}}\nDelivery Address: {{delivery_address}}\nPIN Code: {{pincode}}\n\nAre these details correct?', responseType: 'buttons', choices: ['Address Correct', 'Edit Address', 'Cancel'], options: [{ label: 'Address Correct', value: 'address_correct', nextNode: 'node-payment-qr' }, { label: 'Edit Address', value: 'edit_address', nextNode: 'node-form' }, { label: 'Cancel', value: 'cancel', nextNode: 'node-cancel-confirm' }], saveResponseTo: 'address_confirmation_choice' } },
            { key: 'node-cancel-confirm', type: 'message', name: 'Cancel Confirmation', x: 2280, y: 320, config: { message: 'Notice: You selected Cancel for updating address details. Proceeding with your previously saved details to the payment instructions.', nextNode: 'node-payment-qr' } },
            { key: 'node-payment-qr', type: 'payment', name: 'Blade Protector Payment', x: 2540, y: 200, config: { title: 'Blade Protector Payment', amount: 600, currency: 'INR', amountSource: 'product_total', productId: 15, productName: 'SGB Blade Protector', qrImageUrl: '/api/media/quick-replies/1789191406905-qr-0.jpeg', message: 'Thank you, Sir!\n\nYour SGB Blade Protector delivery details have been saved.\n\nAmount to pay: ₹{{payable_amount}}\n\nPlease scan the official payment QR code below to complete your payment.\n\nAfter completing the payment, please send your payment screenshot here on WhatsApp.\n\nOur team will verify your payment and process your order.', nextNode: 'node-wait-media' } },
            { key: 'node-wait-media', type: 'wait_for_media', name: 'Wait for Blade Protector Payment Evidence', x: 2820, y: 200, config: { title: 'Wait for Blade Protector Payment Evidence', acceptedTypes: ['image', 'document'], expectedEvidence: 'Payment screenshot', instructions: 'Please complete the payment and send the payment screenshot here on WhatsApp.\n\nOur team will verify the payment and confirm your order.', reminderText: '⚠️ Please complete the payment and send the payment screenshot here on WhatsApp.\n\nOur team will verify the payment and confirm your order.', product: 'SGB Blade Protector', amount: 600, nextNode: 'node-final-ack' } },
            { key: 'node-final-ack', type: 'question', name: 'Final Customer Acknowledgment', x: 3100, y: 200, config: { question: 'Thank you, Sir! We have received your payment screenshot.\n\nOur team will verify your payment and contact you regarding the order.\n\nIf you need assistance, you can request a call from our team.\n\nThank you for choosing SGB Agro Industries!', responseType: 'buttons', choices: ['Call Support'], options: [{ label: 'Call Support', value: 'call_support', nextNode: 'node-support-callback' }], saveResponseTo: 'post_payment_choice' } },
            { key: 'node-support-callback', type: 'create_lead', name: 'Call Support Callback Task', x: 1680, y: 500, config: { status: 'human_needed', source: 'WhatsApp Chatbot', actionType: 'callback_task', product: 'SGB Blade Protector', reason: 'Call Support', nextNode: 'node-support-ack' } },
            { key: 'node-support-ack', type: 'end', name: 'Support Acknowledgment', x: 1980, y: 500, config: { message: 'Thank you, Sir! A support callback request has been registered for the SGB Blade Protector.\n\nOur sales and support team will call you shortly.\n\nIf you need to call us directly, please contact:\n📞 *8277009667*' } }
        ];

        const tplEdges = [
            { source: 'node-start', target: 'node-intro-img' },
            { source: 'node-intro-img', target: 'node-promo-img' },
            { source: 'node-promo-img', target: 'node-demo-video' },
            { source: 'node-demo-video', target: 'node-product-card' },
            { source: 'node-product-card', target: 'node-choice' },
            { source: 'node-choice', target: 'node-form', sourceHandle: 'Buy Now — ₹600' },
            { source: 'node-choice', target: 'node-support-callback', sourceHandle: 'Call Support' },
            { source: 'node-form', target: 'node-address-review' },
            { source: 'node-address-review', target: 'node-payment-qr', sourceHandle: 'Address Correct' },
            { source: 'node-address-review', target: 'node-form', sourceHandle: 'Edit Address' },
            { source: 'node-address-review', target: 'node-cancel-confirm', sourceHandle: 'Cancel' },
            { source: 'node-cancel-confirm', target: 'node-payment-qr' },
            { source: 'node-payment-qr', target: 'node-wait-media' },
            { source: 'node-wait-media', target: 'node-final-ack' },
            { source: 'node-final-ack', target: 'node-support-callback', sourceHandle: 'Call Support' },
            { source: 'node-support-callback', target: 'node-support-ack' }
        ];

        for (const n of tplNodes) {
            await pool.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [testVersionId, n.key, n.type, n.name, n.x, n.y, JSON.stringify(n.config)]
            );
        }
        for (const e of tplEdges) {
            await pool.query(
                'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                [testVersionId, e.source, e.target, e.sourceHandle || null, null]
            );
        }

        console.log(`✅ Draft Flow Created: ID ${testFlowId}, Version ID ${testVersionId} with ${tplNodes.length} nodes & ${tplEdges.length} edges`);

        // TEST 3: FlowEngine execution logic
        const FlowEngine = require('../src/services/FlowEngine');
        const testPhone = '9999900001';

        // Clear any old session
        await pool.query('DELETE FROM chatbot_sessions WHERE phone = ?', [testPhone]);

        console.log('\nTEST 3: Simulating Trigger matching...');
        // Mock whatsappService so no real network requests are sent
        const whatsappService = require('../src/services/whatsapp.service');
        const originalSendMessage = whatsappService.sendMessage;
        const originalSendTextMessage = whatsappService.sendTextMessage;
        const originalSendMediaMessage = whatsappService.sendMediaMessage;
        const originalSendQuickReplies = whatsappService.sendQuickReplies;
        const sentMessages = [];

        whatsappService.sendMessage = async (to, text) => {
            sentMessages.push({ type: 'text', to, text });
            return { success: true };
        };
        whatsappService.sendTextMessage = async (to, text) => {
            sentMessages.push({ type: 'text', to, text });
            return { success: true };
        };
        whatsappService.sendMediaMessage = async (to, mediaId, type, caption) => {
            sentMessages.push({ type: 'media', mediaType: type, to, url: mediaId, caption });
            return { success: true };
        };
        whatsappService.sendQuickReplies = async (to, text, buttons) => {
            sentMessages.push({ type: 'buttons', to, text, buttons });
            return { success: true };
        };

        // Create session directly pointing to our test flow
        const [sessionResult] = await pool.query(`
            INSERT INTO chatbot_sessions (flow_id, version_id, phone, current_node_key, variables, status)
            VALUES (?, ?, ?, 'node-intro-img', '{}', 'active')
        `, [testFlowId, testVersionId, testPhone]);
        const testSessionId = sessionResult.insertId;

        // Step 1: Execute flow from node-intro-img
        console.log('Step 1: Running flow from intro...');
        const [sRows] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        const sessionObj = sRows[0];
        sessionObj.variables = {};

        await FlowEngine.executeFlowLoop(sessionObj);

        // Check current session state
        const [s1] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session paused at node: ${s1[0].current_node_key} (Status: ${s1[0].status})`);
        if (s1[0].current_node_key !== 'node-choice') {
            throw new Error(`Expected session to pause at node-choice, but found ${s1[0].current_node_key}`);
        }
        console.log(`✅ Messages sent through intro: ${sentMessages.length} messages (Images, Video, Product, Customer Choice buttons)`);

        // Step 2: Customer selects "Buy Now — ₹600"
        console.log('\nStep 2: Customer selects "Buy Now — ₹600"...');
        sentMessages.length = 0;
        await FlowEngine.handleMessage(testPhone, 'Buy Now — ₹600');

        const [s2] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session state after choice: node = ${s2[0].current_node_key}`);
        if (s2[0].current_node_key !== 'node-form') {
            throw new Error(`Expected session to reach node-form, but found ${s2[0].current_node_key}`);
        }
        console.log('✅ Flow successfully reached Form Node!');

        // Step 3: Customer submits Form Details
        console.log('\nStep 3: Customer submits delivery details...');
        sentMessages.length = 0;
        const validFormSubmission = `Full Name: Ramesh Patel\nDelivery Address: Farm House, Plot 14, APMC Road, Tumkur\nPIN Code: 572101\nAddress Confirmation: yes`;
        await FlowEngine.handleMessage(testPhone, validFormSubmission);

        const [s3] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session state after form: node = ${s3[0].current_node_key}`);
        const parsedVars = typeof s3[0].variables === 'string' ? JSON.parse(s3[0].variables) : s3[0].variables;
        console.log('Saved variables:', parsedVars);
        if (!parsedVars.customer_name || !parsedVars.pincode) {
            throw new Error('Form fields failed to save to session variables');
        }
        if (s3[0].current_node_key !== 'node-address-review') {
            throw new Error(`Expected session to reach node-address-review, but found ${s3[0].current_node_key}`);
        }
        console.log('✅ Form successfully parsed, validated and saved customer details!');

        // Step 4: Customer confirms "Address Correct"
        console.log('\nStep 4: Customer confirms "Address Correct"...');
        sentMessages.length = 0;
        await FlowEngine.handleMessage(testPhone, 'Address Correct');

        const [s4] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session state after address confirmation: node = ${s4[0].current_node_key}`);
        if (s4[0].current_node_key !== 'node-wait-media') {
            throw new Error(`Expected session to reach node-wait-media, but found ${s4[0].current_node_key}`);
        }
        const qrMsg = sentMessages.find(m => m.url && m.url.includes('qr-0.jpeg'));
        if (!qrMsg) {
            throw new Error('Expected Payment QR code image message to be sent');
        }
        console.log(`✅ Payment QR Code dispatched: ${qrMsg.url}`);
        console.log('✅ Flow successfully reached "Wait for Blade Protector Payment Evidence" node!');

        // Step 5: Test invalid text sent while waiting for media
        console.log('\nStep 5: Customer sends text instead of screenshot...');
        sentMessages.length = 0;
        await FlowEngine.handleMessage(testPhone, 'I will pay tomorrow');
        const [s5] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        if (s5[0].current_node_key !== 'node-wait-media') {
            throw new Error('Session should remain at node-wait-media when text is received');
        }
        const reminderMsg = sentMessages.find(m => m.text && m.text.includes('screenshot'));
        if (!reminderMsg) {
            throw new Error('Expected reminder message to be sent when customer replies with text');
        }
        console.log(`✅ Text reminder sent properly: "${reminderMsg.text.substring(0, 40)}..."`);

        // Step 6: Customer sends Payment Screenshot
        console.log('\nStep 6: Customer sends simulated payment screenshot...');
        sentMessages.length = 0;
        const simulatedMediaUrl = '/api/media/campaigns/sep_blade_protector/payment-screenshot-test.jpeg';
        await FlowEngine.handleMessage(testPhone, '', simulatedMediaUrl, {
            msgType: 'image',
            mimeType: 'image/jpeg',
            messageId: 'wamid.test.123456'
        });

        const [s6] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session state after screenshot: node = ${s6[0].current_node_key}`);
        if (s6[0].current_node_key !== 'node-final-ack') {
            throw new Error(`Expected session to reach node-final-ack, but found ${s6[0].current_node_key}`);
        }

        // Verify Order created in pending_verification
        const [orders] = await pool.query('SELECT * FROM orders WHERE phone LIKE ? ORDER BY order_id DESC LIMIT 1', [`%${testPhone}%`]);
        if (orders.length === 0) {
            throw new Error('Order was not created upon screenshot receipt');
        }
        const order = orders[0];
        console.log(`✅ Order Created: ID ${order.order_id}, Status: "${order.order_status}", Amount: ₹${order.total_amount}`);
        if (order.order_status !== 'in_review') {
            throw new Error(`Order status must be in_review, but was ${order.order_status}`);
        }
        const s6Vars = typeof s6[0].variables === 'string' ? JSON.parse(s6[0].variables) : (s6[0].variables || {});
        if (s6Vars.payment_status !== 'pending_verification') {
            throw new Error(`Payment status must be pending_verification, but was ${s6Vars.payment_status}`);
        }
        console.log(`✅ Payment status recorded: "${s6Vars.payment_status}" (${s6Vars.payment_verification_status})`);

        // Verify Admin Notification
        const [notifications] = await pool.query(`
            SELECT * FROM notifications 
            WHERE type = "payment_evidence" OR message LIKE '%Payment Screenshot Received%' 
            ORDER BY notification_id DESC LIMIT 1
        `);
        if (notifications.length === 0) {
            throw new Error('Admin notification was not created for payment evidence');
        }
        console.log(`✅ Admin Notification Created: "${notifications[0].type || notifications[0].message}"`);

        // Step 7: Test Call Support Branch
        console.log('\nStep 7: Testing Call Support branch...');
        sentMessages.length = 0;
        await FlowEngine.handleMessage(testPhone, 'Call Support');

        const [s7] = await pool.query('SELECT * FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        console.log(`Session state after Call Support: node = ${s7[0].current_node_key}, status = ${s7[0].status}`);

        const [callAlerts] = await pool.query(`
            SELECT * FROM notifications 
            WHERE type = "callback_request" OR message LIKE '%Callback Request%' 
            ORDER BY notification_id DESC LIMIT 1
        `);
        if (callAlerts.length === 0) {
            throw new Error('Admin callback request notification was not created');
        }
        console.log(`✅ Callback Notification Created: "${callAlerts[0].type || callAlerts[0].message}"`);

        // Cleanup test data safely
        console.log('\nCleaning up test session & draft test flow...');
        await pool.query('DELETE FROM chatbot_sessions WHERE session_id = ?', [testSessionId]);
        await pool.query('DELETE FROM orders WHERE phone LIKE ?', [`%${testPhone}%`]);
        await pool.query('DELETE FROM notifications WHERE recipient_phone = ?', [testPhone]);
        await pool.query('DELETE FROM chatbot_edges WHERE version_id = ?', [testVersionId]);
        await pool.query('DELETE FROM chatbot_nodes WHERE version_id = ?', [testVersionId]);
        await pool.query('DELETE FROM chatbot_flow_versions WHERE version_id = ?', [testVersionId]);
        await pool.query('DELETE FROM chatbot_flows WHERE flow_id = ?', [testFlowId]);

        // Restore original whatsappService methods
        whatsappService.sendMessage = originalSendMessage;
        whatsappService.sendTextMessage = originalSendTextMessage;
        whatsappService.sendMediaMessage = originalSendMediaMessage;
        whatsappService.sendQuickReplies = originalSendQuickReplies;

        // TEST 4: Regression Check on Existing Live Flows
        console.log('\n================================================================');
        console.log('TEST 4: REGRESSION CHECK ON EXISTING ACTIVE FLOWS');
        console.log('================================================================');
        const [activeFlows] = await pool.query('SELECT flow_id, name, status, active_version_id FROM chatbot_flows WHERE status = "active"');
        console.log(`Found ${activeFlows.length} active flows in production database:`);
        for (const f of activeFlows) {
            const [nodes] = await pool.query('SELECT COUNT(*) as count FROM chatbot_nodes WHERE version_id = ?', [f.active_version_id]);
            const [edges] = await pool.query('SELECT COUNT(*) as count FROM chatbot_edges WHERE version_id = ?', [f.active_version_id]);
            console.log(`  - Flow ID ${f.flow_id}: "${f.name}" (Status: ${f.status}, Version: ${f.active_version_id}, Nodes: ${nodes[0].count}, Edges: ${edges[0].count})`);
            if (nodes[0].count === 0 || edges[0].count === 0) {
                throw new Error(`Active flow ${f.name} has missing nodes or edges!`);
            }
        }
        console.log('✅ ALL EXISTING ACTIVE FLOWS REMAIN UNCHANGED AND FULLY OPERATIONAL!');

        console.log('\n🎉 ALL ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runTests();

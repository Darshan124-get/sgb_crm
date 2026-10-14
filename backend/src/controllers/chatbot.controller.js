const pool = require('../config/db');
const storageService = require('../services/storage.service');
const fs = require('fs');
const path = require('path');

// Helper to log audit events
async function logAudit(connection, flowId, versionId, userId, action, metadata) {
    try {
        await connection.query(
            'INSERT INTO chatbot_audit_logs (flow_id, version_id, user_id, action, metadata) VALUES (?, ?, ?, ?, ?)',
            [flowId, versionId || null, userId || null, action, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error('[AUDIT ERROR]', err);
    }
}

// 0. Get system predefined templates
exports.getTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'just-dumper-enquiry',
                name: 'Just Dumper Enquiry',
                description: 'Asks Place & Pincode, sends Dumper Video & Photo, 10s Delay, Model Purpose choice & Call time slot.',
                category: 'Enquiry',
                icon: 'fa-truck-ramp-box',
                iconColor: 'blue-badge',
                badgeText: 'POPULAR TEMPLATE',
                usageCount: 45,
                previewNodes: ['Place & Pincode', 'Dumper Video', 'Dumper Photo', '10s Delay', 'Model Purpose', 'Preferred Time', 'Create Lead']
            },
            {
                id: 'full-set-trolley-enquiry',
                name: 'Full Set / Trolley Enquiry',
                description: 'Complete lead qualification flow for agri machinery, rotavators, and trolley attachments.',
                category: 'Enquiry',
                icon: 'fa-tractor',
                iconColor: 'green-badge',
                badgeText: 'POPULAR',
                usageCount: 42,
                previewNodes: ['Product Choice', 'Acres Land', 'Time Slot', 'Collect Details', 'Create Lead']
            },
            {
                id: 'dumper-wheelbarrow-enquiry',
                name: 'Dumper Wheelbarrow Enquiry',
                description: 'Qualifies customers looking for normal vs dumper wheelbarrows for construction or farming.',
                category: 'Enquiry',
                icon: 'fa-dolly',
                iconColor: 'purple-badge',
                badgeText: 'HIGH CONVERSION',
                usageCount: 28,
                previewNodes: ['Usage Purpose', 'Barrow Model', 'Product Info', 'Contact Slot', 'Create Lead']
            },
            {
                id: 'lead-qualification-booking',
                name: 'Lead Qualification & Booking',
                description: 'Collects customer name, location, requirement details and schedules sales calls.',
                category: 'Lead Capture',
                icon: 'fa-user-check',
                iconColor: 'purple-badge',
                badgeText: 'RECOMMENDED',
                usageCount: 35,
                previewNodes: ['Welcome', 'Select Interest', 'Collect Phone', 'Preferred Time', 'Save Lead']
            },
            {
                id: 'customer-support-faq',
                name: 'Customer Support & FAQ',
                description: 'Automated 24/7 self-service flow for common customer questions and service requests.',
                category: 'Support',
                icon: 'fa-headset',
                iconColor: 'amber-badge',
                badgeText: '24/7 BOT',
                usageCount: 19,
                previewNodes: ['Main Menu', 'FAQ Topics', 'Service Request', 'Escalate to Agent']
            },
            {
                id: 'product-catalog-showcase',
                name: 'Product Catalog Showcase',
                description: 'Displays product specs, photos, and selling prices directly inside WhatsApp chat.',
                category: 'Sales',
                icon: 'fa-boxes-stacked',
                iconColor: 'teal-badge',
                badgeText: 'SHOWCASE',
                usageCount: 31,
                previewNodes: ['Categories', 'Product Specs', 'Price Quote', 'Buy / Contact']
            },
            {
                id: 'sgb-blade-protector-sales',
                name: 'SGB Blade Protector — Direct WhatsApp Sales',
                description: 'Automated WhatsApp sales flow for the SGB Blade Protector priced at ₹600. Presents product media, collects delivery details, sends the payment QR code, waits for payment evidence, and alerts the admin. Also supports customer-requested call support.',
                category: 'Direct WhatsApp Sales',
                icon: 'fa-shield-halved',
                iconColor: 'green-badge',
                badgeText: 'DIRECT SALES',
                usageCount: 0,
                previewNodes: ['Product Media', 'Customer Choice', 'Delivery Form', 'Address Review', 'Payment QR', 'Wait Screenshot', 'Call Support']
            }
        ];
        res.json(templates);
    } catch (err) {
        console.error('[GET TEMPLATES ERROR]', err);
        res.status(500).json({ message: 'Error fetching templates' });
    }
};

// 0.1 Create flow from template
exports.createFlowFromTemplate = async (req, res) => {
    const { templateId, name, description, category, keywords } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Flow name is required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create flow record
        const [flowResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [name, description || '', category || 'Enquiry', 'draft']
        );
        const flowId = flowResult.insertId;

        // 2. Create version 1.0 (Draft)
        const [versionResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, 1.0, ?)',
            [flowId, 'draft']
        );
        const versionId = versionResult.insertId;

        // 3. Populate nodes & edges based on templateId
        let nodes = [];
        let edges = [];

        if (templateId === 'sgb-blade-protector-sales' || templateId === 'blade-protector-sales' || String(templateId).includes('blade') || String(templateId) === '6') {
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'Hi, I am interested in the SGB Blade Protector, SGB Blade Protector, Blade Protector, blade protector', nextNode: 'node-intro-img' } },
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
            edges = [
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
        } else if (templateId === 'just-dumper-enquiry') {
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'Dumper, dumper, just dumper' } },
                { key: 'node-1', type: 'text_input', name: 'Step 1: Place & Pin Code', x: 280, y: 300, config: { question: 'Q: Sir please share your Place and Pincode\n(ಸರ್ ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳ ಮತ್ತು ಪಿನ್‌ಕೋಡ್ ಹಂಚಿಕೊಳ್ಳಿ)', saveTo: 'place_pincode', saveResponseTo: 'place_pincode', nextNode: 'node-v1' } },
                { key: 'node-v1', type: 'video', name: 'Dumper Video', x: 540, y: 300, config: { mediaUrl: 'https://yvcmjkquuafcgszlkkfu.supabase.co/storage/v1/object/public/SGB/chatbot-media/1788260574245_WhatsApp_Video_2026-09-01_at_4.30.07_PM.mp4', caption: 'Dumper Heavy Duty Video Demonstration', nextNode: 'node-img1' } },
                { key: 'node-img1', type: 'image', name: 'Dumper Photo & Specs', x: 780, y: 300, config: { mediaUrl: 'https://yvcmjkquuafcgszlkkfu.supabase.co/storage/v1/object/public/SGB/chatbot-media/1788261401335_SIDE_PACK_BRUSHCUTTER.png', caption: 'Dumper Model Photo & Specifications', nextNode: 'node-delay1' } },
                { key: 'node-delay1', type: 'time_trigger', name: '10s Delay', x: 1020, y: 300, config: { delayValue: 10, delayUnit: 'seconds', duration: 10, unit: 'seconds', nextNode: 'node-2' } },
                { key: 'node-2', type: 'question', name: 'Step 2: Model Purpose', x: 1260, y: 300, config: { question: 'Q: We have 2 models. What purpose do you need sir?\n(ನಮ್ಮ ಬಳಿ 2 ಮಾದರಿಗಳಿವೆ. ನಿಮಗೆ ಯಾವ ಉದ್ದೇಶಕ್ಕಾಗಿ ಬೇಕು ಸರ್?)', responseType: 'buttons', choices: ['1. Commercial / Heavy Duty', '2. Agricultural / Personal'], options: [{ label: '1. Commercial / Heavy Duty', value: 'commercial', nextNode: 'node-3' }, { label: '2. Agricultural / Personal', value: 'agricultural', nextNode: 'node-3' }], saveResponseTo: 'dumper_purpose' } },
                { key: 'node-3', type: 'question', name: 'Step 3: Call Time', x: 1540, y: 300, config: { question: 'Q: Right time to contact you ?\n(ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಲು ಇದು ಸರಿಯಾದ ಸಮಯವೇ?)', responseType: 'buttons', choices: ['1. 9:30 AM - 1:00 PM', '2. 2:30 PM - 6:00 PM'], options: [{ label: '1. 9:30 AM - 1:00 PM', value: 'morning', nextNode: 'node-lead' }, { label: '2. 2:30 PM - 6:00 PM', value: 'evening', nextNode: 'node-lead' }], saveResponseTo: 'preferred_contact_time' } },
                { key: 'node-lead', type: 'create_lead', name: 'Create Lead', x: 1800, y: 300, config: { fieldMappings: { name: 'place_pincode', purpose: 'dumper_purpose', contactTime: 'preferred_contact_time' }, nextNode: 'node-end' } },
                { key: 'node-end', type: 'end', name: 'End', x: 2020, y: 300, config: { message: 'Thank You!\nOur team will contact you soon.' } }
            ];
            edges = [
                { source: 'node-start', target: 'node-1' },
                { source: 'node-1', target: 'node-v1' },
                { source: 'node-v1', target: 'node-img1' },
                { source: 'node-img1', target: 'node-delay1' },
                { source: 'node-delay1', target: 'node-2' },
                { source: 'node-2', target: 'node-3', sourceHandle: '1. Commercial / Heavy Duty' },
                { source: 'node-2', target: 'node-3', sourceHandle: '2. Agricultural / Personal' },
                { source: 'node-3', target: 'node-lead', sourceHandle: '1. 9:30 AM - 1:00 PM' },
                { source: 'node-3', target: 'node-lead', sourceHandle: '2. 2:30 PM - 6:00 PM' },
                { source: 'node-lead', target: 'node-end' }
            ];
        } else if (templateId === 'dumper-wheelbarrow-enquiry') {
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'Dumper, dumper, wheelbarrow' } },
                { key: 'node-1', type: 'text_input', name: 'Step 1', x: 280, y: 220, config: { question: 'Q: What purpose you are looking for ?\n(If you specify its easy for us to suggest model)', saveTo: 'purpose', saveResponseTo: 'purpose', nextNode: 'node-2' } },
                { key: 'node-2', type: 'question', name: 'Step 2', x: 580, y: 220, config: { question: 'Q: Normal Wheel borrow or Dumper Wheel Borrow', responseType: 'buttons', choices: ['1. Normal Wheel Borrow', '2. Dumper Wheel Borrow'], options: [{ label: '1. Normal Wheel Borrow', value: 'normal', nextNode: 'node-p1' }, { label: '2. Dumper Wheel Borrow', value: 'dumper', nextNode: 'node-p2' }], saveResponseTo: 'barrow_type' } },
                { key: 'node-p1', type: 'product', name: 'Send price of Normal Wheel Borrow', x: 880, y: 140, config: { productId: 4, product: 'Normal Wheel Barrow', price: '₹4,500', desc: 'Heavy duty single wheel barrow', message: 'Send price of Normal Wheel Borrow', nextNode: 'node-3' } },
                { key: 'node-p2', type: 'product', name: 'Send price of Dumper Wheel Borrow', x: 880, y: 340, config: { productId: 3, product: 'Dumper Wheel Barrow', price: '₹12,000', desc: 'Heavy duty dual wheel barrow with tilt box', message: 'Send price of Dumper Wheel Borrow', nextNode: 'node-3' } },
                { key: 'node-3', type: 'question', name: 'Step 3', x: 1180, y: 240, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-4' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-4' }], saveResponseTo: 'preferred_contact_time' } },
                { key: 'node-4', type: 'text_input', name: 'Step 4', x: 1460, y: 240, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', saveTo: 'name_place', saveResponseTo: 'name_place', nextNode: 'node-lead' } },
                { key: 'node-lead', type: 'create_lead', name: 'Create Lead', x: 1680, y: 240, config: { fieldMappings: { name: 'name_place', product: 'barrow_type', land: 'purpose', contactTime: 'preferred_contact_time' }, nameVar: 'name_place', status: 'new', source: 'WhatsApp Chatbot', nextNode: 'node-end' } },
                { key: 'node-end', type: 'end', name: 'End', x: 1880, y: 240, config: { message: 'Thank You!\nOur team will contact you soon.' } }
            ];
            edges = [
                { source: 'node-start', target: 'node-1' },
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-p1', sourceHandle: '1. Normal Wheel Borrow' },
                { source: 'node-2', target: 'node-p2', sourceHandle: '2. Dumper Wheel Borrow' },
                { source: 'node-p1', target: 'node-3' },
                { source: 'node-p2', target: 'node-3' },
                { source: 'node-3', target: 'node-4', sourceHandle: '1. 9:30 - 1:00 PM' },
                { source: 'node-3', target: 'node-4', sourceHandle: '2. 2:30 - 6:00 PM' },
                { source: 'node-4', target: 'node-lead' },
                { source: 'node-lead', target: 'node-end' }
            ];
        } else {
            // Default full-set-trolley-enquiry template
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 250, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'trolley, full set' } },
                { key: 'node-1', type: 'question', name: 'Step 1', x: 280, y: 250, config: { question: 'Q: Sir do you need a full set or Trolley ?', responseType: 'buttons', choices: ['Full Set', 'Trolley'], options: [{ label: 'Full Set', value: 'full_set', nextNode: 'node-2' }, { label: 'Trolley', value: 'trolley', nextNode: 'node-3' }], saveResponseTo: 'product_interest' } },
                { key: 'node-2', type: 'question', name: 'Step 2', x: 520, y: 100, config: { question: 'Q: How much Acre land do you have sir ?\n(Sir nimm jaaga estu ide ant gottu adra, navu machine suggest madtivi sir)', responseType: 'buttons', choices: ['1. Below 2 Acre', '2. 2 - 5 Acre', '3. More than 5 Acre'], options: [{ label: '1. Below 2 Acre', value: 'below_2_acre', nextNode: 'node-4' }, { label: '2. 2 - 5 Acre', value: '2_5_acre', nextNode: 'node-5' }, { label: '3. More than 5 Acre', value: 'more_5_acre', nextNode: 'node-6' }], saveResponseTo: 'land_acres' } },
                { key: 'node-3', type: 'question', name: 'Step: Brush Cutter', x: 520, y: 440, config: { question: 'Q: Which brush cutter do you have sir?', responseType: 'buttons', choices: ['1. Side pack 1', '2. Side pack 2', '3. Don\'t know'], options: [{ label: '1. Side pack 1', value: 'side_pack_1', nextNode: 'node-7' }, { label: '2. Side pack 2', value: 'side_pack_2', nextNode: 'node-8' }, { label: '3. Don\'t know', value: 'dont_know', nextNode: 'node-9' }], saveResponseTo: 'brush_cutter_type' } },
                { key: 'node-4', type: 'product', name: 'Send details of Machine 12K', x: 780, y: 40, config: { productId: 1, product: 'Machine 12K', message: 'Send details of Machine 12K', nextNode: 'node-10' } },
                { key: 'node-5', type: 'product', name: 'Send details of Machine 16K & 21K', x: 780, y: 160, config: { productId: 2, product: 'Machine 16K & 21K', message: 'Send details of Machine 16K & 21K', nextNode: 'node-10' } },
                { key: 'node-6', type: 'product', name: 'Send details of Machine 21K', x: 780, y: 280, config: { productId: 3, product: 'Machine 21K', message: 'Send details of Machine 21K', nextNode: 'node-10' } },
                { key: 'node-7', type: 'product', name: 'Send details of Side Pack 1', x: 780, y: 400, config: { productId: 4, product: 'Side Pack 1', message: 'Send details of Side Pack 1', nextNode: 'node-10' } },
                { key: 'node-8', type: 'product', name: 'Send details of Side Pack 2', x: 780, y: 520, config: { productId: 5, product: 'Side Pack 2', message: 'Send details of Side Pack 2', nextNode: 'node-10' } },
                { key: 'node-9', type: 'message', name: 'Reply Message: Photo Request', x: 780, y: 640, config: { message: 'Reply Message:\nSir please send photo of your brush cutter', inputType: 'image', nextNode: 'node-10' } },
                { key: 'node-10', type: 'question', name: 'Step 3', x: 1050, y: 280, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-11' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-11' }], saveResponseTo: 'preferred_contact_time' } },
                { key: 'node-11', type: 'text_input', name: 'Step 4', x: 1300, y: 280, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', choices: ['Name & Place'], options: [{ label: 'Name & Place', value: 'name_place', nextNode: 'node-12' }], saveResponseTo: 'name_place', nextNode: 'node-12' } },
                { key: 'node-12', type: 'create_lead', name: 'Create Lead', x: 1480, y: 280, config: { nextNode: 'node-13' } },
                { key: 'node-13', type: 'end', name: 'End', x: 1640, y: 280, config: { message: 'Thank You!\nOur team will contact you soon.' } }
            ];
            edges = [
                { source: 'node-start', target: 'node-1' },
                { source: 'node-1', target: 'node-2', sourceHandle: 'Full Set' },
                { source: 'node-1', target: 'node-3', sourceHandle: 'Trolley' },
                { source: 'node-2', target: 'node-4', sourceHandle: '1. Below 2 Acre' },
                { source: 'node-2', target: 'node-5', sourceHandle: '2. 2 - 5 Acre' },
                { source: 'node-2', target: 'node-6', sourceHandle: '3. More than 5 Acre' },
                { source: 'node-3', target: 'node-7', sourceHandle: '1. Side pack 1' },
                { source: 'node-3', target: 'node-8', sourceHandle: '2. Side pack 2' },
                { source: 'node-3', target: 'node-9', sourceHandle: "3. Don't know" },
                { source: 'node-4', target: 'node-10' },
                { source: 'node-5', target: 'node-10' },
                { source: 'node-6', target: 'node-10' },
                { source: 'node-7', target: 'node-10' },
                { source: 'node-8', target: 'node-10' },
                { source: 'node-9', target: 'node-10' },
                { source: 'node-10', target: 'node-11', sourceHandle: '1. 9:30 - 1:00 PM' },
                { source: 'node-10', target: 'node-11', sourceHandle: '2. 2:30 - 6:00 PM' },
                { source: 'node-11', target: 'node-12' },
                { source: 'node-12', target: 'node-13' }
            ];
        }

        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [versionId, n.key, n.type, n.name, n.x, n.y, JSON.stringify(n.config)]
            );
        }

        for (const e of edges) {
            await connection.query(
                'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                [versionId, e.source, e.target, e.sourceHandle || null, null]
            );
        }

        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Created from Template', { templateId, name });

        await connection.commit();
        res.status(201).json({ flow_id: flowId, message: 'Flow created from template successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[CREATE FLOW FROM TEMPLATE ERROR]', err);
        res.status(500).json({ message: 'Error creating flow from template' });
    } finally {
        connection.release();
    }
};

// 1. Get all flows
exports.getFlows = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT f.*, 
                   COALESCE(v.version_number, 1.0) as active_version,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id AND s.lead_id IS NOT NULL) as lead_count,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id) as total_sessions,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id AND s.status = 'completed') as completed_sessions,
                   u.name as creator_name
            FROM chatbot_flows f 
            LEFT JOIN chatbot_flow_versions v ON f.active_version_id = v.version_id 
            LEFT JOIN users u ON f.created_by = u.user_id
            WHERE f.status != 'archived'
            ORDER BY f.updated_at DESC
        `);

        for (let flow of rows) {
            try {
                const [nodes] = await pool.query(`
                    SELECT n.config FROM chatbot_nodes n
                    JOIN chatbot_flow_versions v ON n.version_id = v.version_id
                    WHERE v.flow_id = ? AND n.node_type = 'start'
                    LIMIT 1
                `, [flow.flow_id]);
                if (nodes.length > 0) {
                    const cfg = typeof nodes[0].config === 'string' ? JSON.parse(nodes[0].config) : nodes[0].config;
                    flow.triggerType = cfg?.triggerType || 'Keyword';
                    flow.triggerKeywords = cfg?.keywords ? cfg.keywords.split(',').map(s => s.trim()) : [];
                }
            } catch (e) {
                flow.triggerType = 'Keyword';
                flow.triggerKeywords = [];
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('[GET FLOWS ERROR]', err);
        res.status(500).json({ message: 'Error fetching chatbot flows' });
    }
};

// 2. Get specific flow details (draft nodes/edges/settings + all versions list)
exports.getFlow = async (req, res) => {
    const flowId = req.params.flowId;
    try {
        // Fetch flow metadata
        const [flowRows] = await pool.query('SELECT * FROM chatbot_flows WHERE flow_id = ?', [flowId]);
        if (flowRows.length === 0) {
            return res.status(404).json({ message: 'Flow not found' });
        }
        const flow = flowRows[0];

        // Fetch all versions
        const [versions] = await pool.query(
            'SELECT * FROM chatbot_flow_versions WHERE flow_id = ? ORDER BY version_number DESC',
            [flowId]
        );

        // Determine which version ID to load (default is the draft version, fallback to active)
        let draftVersion = versions.find(v => v.status === 'draft');
        let activeVersion = versions.find(v => v.version_id === flow.active_version_id);
        let versionToLoad = draftVersion || activeVersion || versions[0];

        let nodes = [];
        let edges = [];

        if (versionToLoad) {
            // Load nodes from preferred version
            const [nodeRows] = await pool.query(
                'SELECT node_key as `id`, node_type as `type`, name, position_x as `x`, position_y as `y`, config FROM chatbot_nodes WHERE version_id = ?',
                [versionToLoad.version_id]
            );

            // If draft has no nodes but published version has nodes, use published version for display
            if (nodeRows.length === 0 && draftVersion && activeVersion && draftVersion.version_id !== activeVersion.version_id) {
                const [publishedNodeRows] = await pool.query(
                    'SELECT node_key as `id`, node_type as `type`, name, position_x as `x`, position_y as `y`, config FROM chatbot_nodes WHERE version_id = ?',
                    [activeVersion.version_id]
                );
                if (publishedNodeRows.length > 0) {
                    versionToLoad = activeVersion;
                    nodes = publishedNodeRows.map(n => ({
                        id: n.id,
                        type: n.type,
                        name: n.name,
                        position: { x: n.x, y: n.y },
                        config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config
                    }));
                    const [publishedEdgeRows] = await pool.query(
                        'SELECT source_node_key as `source`, target_node_key as `target`, source_handle as `sourceHandle`, target_handle as `targetHandle` FROM chatbot_edges WHERE version_id = ?',
                        [activeVersion.version_id]
                    );
                    edges = publishedEdgeRows.map(e => ({
                        id: `e-${e.source}-${e.target}-${e.sourceHandle || 'default'}`,
                        source: e.source,
                        target: e.target,
                        sourceHandle: e.sourceHandle,
                        targetHandle: e.targetHandle
                    }));
                }
            } else {
                nodes = nodeRows.map(n => ({
                    id: n.id,
                    type: n.type,
                    name: n.name,
                    position: { x: n.x, y: n.y },
                    config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config
                }));

                // Load edges
                const [edgeRows] = await pool.query(
                    'SELECT source_node_key as `source`, target_node_key as `target`, source_handle as `sourceHandle`, target_handle as `targetHandle` FROM chatbot_edges WHERE version_id = ?',
                    [versionToLoad.version_id]
                );
                edges = edgeRows.map(e => ({
                    id: `e-${e.source}-${e.target}-${e.sourceHandle || 'default'}`,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle
                }));
            }
        }

        res.json({
            flow,
            versions,
            nodes,
            edges,
            activeVersionNumber: activeVersion ? activeVersion.version_number : null,
            loadedVersionNumber: versionToLoad ? versionToLoad.version_number : null,
            loadedVersionId: versionToLoad ? versionToLoad.version_id : null
        });
    } catch (err) {
        console.error('[GET FLOW ERROR]', err);
        res.status(500).json({ message: 'Error fetching flow details' });
    }
};

// 3. Create a new flow
exports.createFlow = async (req, res) => {
    const { name, description, category, triggerType, keywords } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Flow name is required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert flow metadata
        const [flowResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [name, description || '', category || 'enquiry', 'draft']
        );
        const flowId = flowResult.insertId;

        // 2. Insert version 1.0 (Draft)
        const [versionResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
            [flowId, 1.0, 'draft']
        );
        const versionId = versionResult.insertId;

        // 3. Seed Start node
        const startNodeConfig = {
            triggerType: triggerType || 'Keyword',
            keywords: keywords || 'hello, help'
        };
        await connection.query(
            'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [versionId, 'node-start', 'start', 'Start', 400, 100, JSON.stringify(startNodeConfig)]
        );

        // Audit Log
        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Created', { name, triggerType });

        await connection.commit();
        res.status(201).json({ flow_id: flowId, message: 'Flow created successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[CREATE FLOW ERROR]', err);
        res.status(500).json({ message: 'Error creating flow' });
    } finally {
        connection.release();
    }
};

// 4. Save Flow Draft
exports.saveDraft = async (req, res) => {
    const flowId = req.params.flowId;
    const { nodes, edges, settings } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if draft version exists (target latest draft version)
        let [versionRows] = await connection.query(
            'SELECT version_id FROM chatbot_flow_versions WHERE flow_id = ? AND status = "draft" ORDER BY version_number DESC LIMIT 1',
            [flowId]
        );

        let versionId;
        if (versionRows.length === 0) {
            // Find latest published version to increment
            const [pubRows] = await connection.query(
                'SELECT MAX(version_number) as max_ver FROM chatbot_flow_versions WHERE flow_id = ?',
                [flowId]
            );
            const nextVer = pubRows[0].max_ver ? parseFloat(pubRows[0].max_ver) + 0.1 : 1.0;

            const [versionResult] = await connection.query(
                'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
                [flowId, nextVer, 'draft']
            );
            versionId = versionResult.insertId;
        } else {
            versionId = versionRows[0].version_id;
        }

        // Clean up existing nodes and edges for this draft
        await connection.query('DELETE FROM chatbot_nodes WHERE version_id = ?', [versionId]);
        await connection.query('DELETE FROM chatbot_edges WHERE version_id = ?', [versionId]);

        // Insert new nodes
        if (nodes && Array.isArray(nodes)) {
            for (const node of nodes) {
                const posX = node.position ? node.position.x : 0;
                const posY = node.position ? node.position.y : 0;
                const cfg = node.config || {};
                if (node.type === 'question') {
                    const optCount = cfg.options ? cfg.options.length : (cfg.choices ? cfg.choices.length : 0);
                    if (optCount > 3 && (cfg.responseType === 'buttons' || !cfg.responseType)) {
                        cfg.responseType = 'list';
                    }
                }
                await connection.query(
                    'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [versionId, node.id, node.type, node.name, posX, posY, JSON.stringify(cfg)]
                );
            }
        }

        // Insert new edges
        if (edges && Array.isArray(edges)) {
            for (const edge of edges) {
                if (!edge.source || !edge.target || edge.source === edge.target) {
                    continue; // Ignore self-looping edges
                }
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [versionId, edge.source, edge.target, edge.sourceHandle || null, edge.targetHandle || null]
                );
            }
        }

        // Update settings/metadata in chatbot_flows
        if (settings) {
            await connection.query(
                'UPDATE chatbot_flows SET name = ?, description = ?, category = ?, status = ? WHERE flow_id = ?',
                [settings.name, settings.description || '', settings.category || 'enquiry', settings.status || 'draft', flowId]
            );
        }

        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Draft Saved', { node_count: nodes?.length });

        await connection.commit();
        res.json({ message: 'Draft saved successfully' });
    } catch (err) {
        try { await connection.rollback(); } catch (rbErr) { }
        console.error('[SAVE DRAFT ERROR]', err.message);
        res.status(500).json({ message: 'Error saving draft' });
    } finally {
        try { connection.release(); } catch (relErr) { }
    }
};

// 5. Validate & Publish Flow
exports.publishFlow = async (req, res) => {
    const flowId = req.params.flowId;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get draft version ID
        const [verRows] = await connection.query(
            'SELECT version_id, version_number FROM chatbot_flow_versions WHERE flow_id = ? AND status = "draft" ORDER BY version_id DESC LIMIT 1',
            [flowId]
        );

        if (verRows.length === 0) {
            try { await connection.rollback(); } catch (e) { }
            return res.status(404).json({ message: 'No draft version found to publish' });
        }

        const draftVersionId = verRows[0].version_id;
        const currentVerNum = parseFloat(verRows[0].version_number) || 1.0;

        // 2. Load draft nodes and edges for validation
        const [nodes] = await connection.query('SELECT * FROM chatbot_nodes WHERE version_id = ?', [draftVersionId]);
        const [edges] = await connection.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [draftVersionId]);

        const errors = [];
        const warnings = [];

        // Check 1: Must have exactly one start node
        const startNodes = nodes.filter(n => n.node_type === 'start');
        if (startNodes.length === 0) errors.push('Flow has no Start node.');
        if (startNodes.length > 1) errors.push('Flow contains multiple Start nodes.');

        // Check 2: All interactive nodes check WhatsApp limits & auto-convert >3 buttons to List type
        for (const n of nodes) {
            let config = {};
            try { config = typeof n.config === 'string' ? JSON.parse(n.config) : (n.config || {}); } catch (e) { }
            if (n.node_type === 'question') {
                const optCount = config.options ? config.options.length : (config.choices ? config.choices.length : 0);
                const respType = config.responseType || 'buttons';
                if (respType === 'buttons' && optCount > 3) {
                    if (optCount <= 10) {
                        // Auto-promote to list menu for WhatsApp compatibility
                        config.responseType = 'list';
                        n.config = JSON.stringify(config);
                        await connection.query('UPDATE chatbot_nodes SET config = ? WHERE version_id = ? AND node_key = ?', [n.config, draftVersionId, n.node_key]);
                    } else {
                        errors.push(`Question node "${n.name}" has ${optCount} options. WhatsApp Cloud API List menus support a maximum of 10 items.`);
                    }
                } else if (respType === 'list' && optCount > 10) {
                    errors.push(`List option node "${n.name}" has ${optCount} items. WhatsApp List menus support a maximum of 10 items.`);
                }
            }
        }

        // Check 3: Missing destinations
        edges.forEach(e => {
            if (!e.target_node_key) {
                errors.push(`Connection from "${e.source_node_key}" has no destination node.`);
            }
        });

        if (errors.length > 0) {
            try { await connection.rollback(); } catch (e) { }
            return res.status(400).json({ message: 'Validation failed before publish', errors, warnings });
        }

        // 3. Mark draft version as published
        await connection.query(
            'UPDATE chatbot_flow_versions SET status = "published", published_at = NOW() WHERE version_id = ?',
            [draftVersionId]
        );

        // 4. Set flow status to active and active_version_id to this version
        await connection.query(
            'UPDATE chatbot_flows SET status = "active", active_version_id = ? WHERE flow_id = ?',
            [draftVersionId, flowId]
        );

        // 5. Create a new draft version for subsequent editing
        const nextVerNum = (currentVerNum + 0.1).toFixed(1);
        const [newVerResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
            [flowId, nextVerNum, 'draft']
        );
        const newDraftVersionId = newVerResult.insertId;

        // Clone nodes to the new draft
        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newDraftVersionId, n.node_key, n.node_type, n.name, n.position_x, n.position_y, n.config]
            );
        }

        // Clone edges to the new draft
        for (const e of edges) {
            if (e.source_node_key && e.target_node_key && e.source_node_key !== e.target_node_key) {
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [newDraftVersionId, e.source_node_key, e.target_node_key, e.source_handle, e.target_handle]
                );
            }
        }

        await logAudit(connection, flowId, draftVersionId, req.user?.id, 'Flow Published', { version: currentVerNum });

        await connection.commit();
        res.json({ message: 'Flow published successfully', active_version: currentVerNum, next_draft_version: nextVerNum });
    } catch (err) {
        try { await connection.rollback(); } catch (rbErr) { }
        console.error('[PUBLISH FLOW ERROR]', err.message);
        res.status(500).json({ message: 'Error publishing flow' });
    } finally {
        try { connection.release(); } catch (relErr) { }
    }
};

// 6. Duplicate Flow
exports.duplicateFlow = async (req, res) => {
    const flowId = req.params.flowId;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Get original flow metadata
        const [flowRows] = await connection.query('SELECT * FROM chatbot_flows WHERE flow_id = ?', [flowId]);
        if (flowRows.length === 0) {
            try { await connection.rollback(); } catch (e) { }
            return res.status(404).json({ message: 'Original flow not found' });
        }
        const orig = flowRows[0];

        // Create flow copy
        const [copyResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [`${orig.name} Copy`, orig.description || '', orig.category || 'enquiry', 'draft']
        );
        const newFlowId = copyResult.insertId;

        // Get latest version ID of original flow
        const [verRows] = await connection.query(
            'SELECT version_id FROM chatbot_flow_versions WHERE flow_id = ? ORDER BY version_number DESC LIMIT 1',
            [flowId]
        );
        if (verRows.length > 0) {
            const origVersionId = verRows[0].version_id;

            // Create version 1.0 (Draft) for copy
            const [newVerResult] = await connection.query(
                'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, 1.0, "draft")',
                [newFlowId]
            );
            const newVersionId = newVerResult.insertId;

            // Clone nodes
            const [nodes] = await connection.query('SELECT * FROM chatbot_nodes WHERE version_id = ?', [origVersionId]);
            for (const n of nodes) {
                await connection.query(
                    'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [newVersionId, n.node_key, n.node_type, n.name, n.position_x, n.position_y, n.config]
                );
            }

            // Clone edges
            const [edges] = await connection.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [origVersionId]);
            for (const e of edges) {
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [newVersionId, e.source_node_key, e.target_node_key, e.source_handle, e.target_handle]
                );
            }
        }

        await logAudit(connection, newFlowId, null, req.user?.id, 'Flow Duplicated', { from_flow_id: flowId });

        await connection.commit();
        res.json({ duplicated_flow_id: newFlowId, message: 'Flow duplicated successfully' });
    } catch (err) {
        try { await connection.rollback(); } catch (rbErr) { }
        console.error('[DUPLICATE FLOW ERROR]', err.message);
        res.status(500).json({ message: 'Error duplicating flow' });
    } finally {
        try { connection.release(); } catch (relErr) { }
    }
};

// 7. Archive/Soft-delete Flow
exports.deleteFlow = async (req, res) => {
    const flowId = req.params.flowId;
    try {
        await pool.query('UPDATE chatbot_flows SET status = "archived" WHERE flow_id = ?', [flowId]);
        res.json({ message: 'Flow archived successfully' });
    } catch (err) {
        console.error('[DELETE FLOW ERROR]', err);
        res.status(500).json({ message: 'Error archiving flow' });
    }
};

// 7.1 Update Flow Status (active, draft, stopped)
exports.updateFlowStatus = async (req, res) => {
    const flowId = req.params.flowId;
    const { status } = req.body;
    if (!status || !['active', 'draft', 'stopped', 'archived'].includes(status.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid status value. Allowed: active, draft, stopped, archived' });
    }

    try {
        await pool.query('UPDATE chatbot_flows SET status = ? WHERE flow_id = ?', [status.toLowerCase(), flowId]);
        await logAudit(pool, flowId, null, req.user?.id, 'Status Updated', { status });
        res.json({ message: `Flow status updated to ${status}` });
    } catch (err) {
        console.error('[UPDATE FLOW STATUS ERROR]', err);
        res.status(500).json({ message: 'Error updating flow status' });
    }
};

// 8. Global settings retrieval
exports.getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM chatbot_settings ORDER BY id DESC LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) {
        console.error('[GET SETTINGS ERROR]', err);
        res.status(500).json({ message: 'Error fetching chatbot settings' });
    }
};

// 9. Update global settings
exports.updateSettings = async (req, res) => {
    const { ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token } = req.body;
    try {
        await pool.query(`
            INSERT INTO chatbot_settings (id, ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token) 
            VALUES (1, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                ai_fallback_enabled = VALUES(ai_fallback_enabled),
                ai_model = VALUES(ai_model),
                ai_temperature = VALUES(ai_temperature),
                default_fallback_msg = VALUES(default_fallback_msg),
                max_fallback_attempts = VALUES(max_fallback_attempts),
                webhook_url = VALUES(webhook_url),
                webhook_token = VALUES(webhook_token)
        `, [ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token]);
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        console.error('[UPDATE SETTINGS ERROR]', err);
        res.status(500).json({ message: 'Error updating chatbot settings' });
    }
};

// 10. Node types helper registry
exports.getNodeTypes = (req, res) => {
    res.json({
        question: { label: 'Question', desc: 'Ask a multiple choice or free text question' },
        buttons: { label: 'Buttons', desc: 'Send quick-reply buttons (Max 3)' },
        list: { label: 'List Options', desc: 'Send WhatsApp list options menu (Max 10)' },
        text_input: { label: 'Text Input', desc: 'Request user to type open text response' },
        number_input: { label: 'Number Input', desc: 'Request and validate numeric answers' },
        contact_time: { label: 'Contact Time', desc: 'Allow user to pick standard time slot' },
        message: { label: 'Text Message', desc: 'Send simple WhatsApp text response' },
        image: { label: 'Send Image', desc: 'Send image URL from media library' },
        video: { label: 'Send Video', desc: 'Send video media from gallery' },
        product: { label: 'Product Card', desc: 'Send pricing card from inventory list' },
        save_lead_field: { label: 'Save CRM Field', desc: 'Binds variable answer to lead column' },
        create_lead: { label: 'Create CRM Lead', desc: 'Generates lead in CRM system' },
        human_handoff: { label: 'Human Handoff', desc: 'Escalates session and pauses bot' },
        form: { label: 'Form', desc: 'Collect structured customer fields (delivery details)' },
        payment: { label: 'Payment / QR Code', desc: 'Send payment instructions & QR image for product order' },
        wait_for_media: { label: 'Wait for Screenshot / Media', desc: 'Wait for customer to send payment screenshot or media' },
        time_trigger: { label: 'Time Trigger / Delay', desc: 'Pauses execution for specified duration before next step' },
        end: { label: 'End Flow', desc: 'Terminates chatbot flow session' }
    });
};

// ==========================================
// CHATBOT PRODUCTS & MEDIA CONTROLLER API
// ==========================================

// 11. Get all products with filters
exports.getProducts = async (req, res) => {
    try {
        const { category, status, search } = req.query;
        let query = 'SELECT * FROM chatbot_products WHERE 1=1';
        const params = [];

        if (category && category !== 'all' && category !== 'All Products') {
            query += ' AND category = ?';
            params.push(category);
        }
        if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ? OR tags LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params);

        const formatted = rows.map(r => ({
            ...r,
            gallery_urls: typeof r.gallery_urls === 'string' ? JSON.parse(r.gallery_urls || '[]') : (r.gallery_urls || []),
            specs: typeof r.specs === 'string' ? JSON.parse(r.specs || '[]') : (r.specs || []),
            tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : (r.tags || [])
        }));

        res.json(formatted);
    } catch (err) {
        console.error('[GET CHATBOT PRODUCTS ERROR]', err);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

// 12. Create product
exports.createProduct = async (req, res) => {
    try {
        const { name, sku, category, price, status, description, image_url, gallery_urls, specs, tags } = req.body;
        if (!name || !category) {
            return res.status(400).json({ message: 'Product name and category are required' });
        }

        const generatedSku = sku || `PROD-${Date.now().toString().slice(-6)}`;
        const prodPrice = parseFloat(price) || 0;
        const prodStatus = status || 'active';
        const galleryJson = JSON.stringify(Array.isArray(gallery_urls) ? gallery_urls : []);
        const specsJson = JSON.stringify(Array.isArray(specs) ? specs : []);
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

        const [result] = await pool.query(`
            INSERT INTO chatbot_products 
            (name, sku, category, price, status, description, image_url, gallery_urls, specs, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, generatedSku, category, prodPrice, prodStatus, description || '', image_url || '', galleryJson, specsJson, tagsJson]);

        const [newRows] = await pool.query('SELECT * FROM chatbot_products WHERE id = ?', [result.insertId]);
        const newProduct = newRows[0];
        newProduct.gallery_urls = JSON.parse(newProduct.gallery_urls || '[]');
        newProduct.specs = JSON.parse(newProduct.specs || '[]');
        newProduct.tags = JSON.parse(newProduct.tags || '[]');

        res.status(201).json(newProduct);
    } catch (err) {
        console.error('[CREATE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error creating product: ' + err.message });
    }
};

// 13. Update product
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, sku, category, price, status, description, image_url, gallery_urls, specs, tags } = req.body;

        const galleryJson = JSON.stringify(Array.isArray(gallery_urls) ? gallery_urls : []);
        const specsJson = JSON.stringify(Array.isArray(specs) ? specs : []);
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

        await pool.query(`
            UPDATE chatbot_products SET
                name = COALESCE(?, name),
                sku = COALESCE(?, sku),
                category = COALESCE(?, category),
                price = COALESCE(?, price),
                status = COALESCE(?, status),
                description = COALESCE(?, description),
                image_url = COALESCE(?, image_url),
                gallery_urls = COALESCE(?, gallery_urls),
                specs = COALESCE(?, specs),
                tags = COALESCE(?, tags)
            WHERE id = ?
        `, [name, sku, category, price, status, description, image_url, galleryJson, specsJson, tagsJson, productId]);

        const [rows] = await pool.query('SELECT * FROM chatbot_products WHERE id = ?', [productId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });

        const updated = rows[0];
        updated.gallery_urls = JSON.parse(updated.gallery_urls || '[]');
        updated.specs = JSON.parse(updated.specs || '[]');
        updated.tags = JSON.parse(updated.tags || '[]');

        res.json(updated);
    } catch (err) {
        console.error('[UPDATE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error updating product' });
    }
};

// 14. Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        await pool.query('DELETE FROM chatbot_products WHERE id = ?', [productId]);
        res.json({ message: 'Product deleted successfully', id: productId });
    } catch (err) {
        console.error('[DELETE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

// 15. Get categories with dynamic product count
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                c.id, 
                c.name, 
                c.icon,
                COUNT(p.id) AS count
            FROM chatbot_categories c
            LEFT JOIN chatbot_products p ON c.name = p.category
            GROUP BY c.id, c.name, c.icon
            ORDER BY c.id ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('[GET CATEGORIES ERROR]', err);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

// 16. Create category
exports.createCategory = async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required' });

        const categoryIcon = icon || 'fa-layer-group';
        const [result] = await pool.query('INSERT INTO chatbot_categories (name, icon) VALUES (?, ?)', [name, categoryIcon]);
        res.status(201).json({ id: result.insertId, name, icon: categoryIcon, count: 0 });
    } catch (err) {
        console.error('[CREATE CATEGORY ERROR]', err);
        res.status(500).json({ message: 'Error creating category: ' + err.message });
    }
};

// 16.1 Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        await pool.query('DELETE FROM chatbot_categories WHERE id = ?', [categoryId]);
        res.json({ message: 'Category deleted successfully', id: categoryId });
    } catch (err) {
        console.error('[DELETE CATEGORY ERROR]', err);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

// 16.2 Bulk Import Products
exports.importProducts = async (req, res) => {
    try {
        const { products } = req.body;
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'No products array provided for import' });
        }

        let importedCount = 0;
        for (const p of products) {
            if (!p.name || !p.category) continue;

            const generatedSku = p.sku || `PROD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const prodPrice = parseFloat(p.price) || 0;
            const prodStatus = p.status || 'active';
            const galleryJson = JSON.stringify(Array.isArray(p.gallery_urls) ? p.gallery_urls : [p.image_url || '../../assets/images/red_power_tiller.jpg']);
            const specsJson = JSON.stringify(Array.isArray(p.specs) ? p.specs : []);
            const tagsJson = JSON.stringify(Array.isArray(p.tags) ? p.tags : ['imported']);

            await pool.query(`
                INSERT INTO chatbot_products 
                (name, sku, category, price, status, description, image_url, gallery_urls, specs, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    price = VALUES(price),
                    status = VALUES(status),
                    description = VALUES(description)
            `, [p.name, generatedSku, p.category, prodPrice, prodStatus, p.description || '', p.image_url || '../../assets/images/red_power_tiller.jpg', galleryJson, specsJson, tagsJson]);

            importedCount++;
        }

        res.status(201).json({ message: `Successfully imported ${importedCount} products`, count: importedCount });
    } catch (err) {
        console.error('[IMPORT PRODUCTS ERROR]', err);
        res.status(500).json({ message: 'Error importing products: ' + err.message });
    }
};

// 17. Get media items
exports.getMedia = async (req, res) => {
    try {
        const { type, search } = req.query;
        let query = 'SELECT * FROM chatbot_media WHERE 1=1';
        const params = [];

        if (type && type !== 'all') {
            let targetType = type.toLowerCase();
            if (targetType === 'images') targetType = 'image';
            else if (targetType === 'videos') targetType = 'video';
            else if (targetType === 'documents') targetType = 'document';
            query += ' AND file_type = ?';
            params.push(targetType);
        }
        if (search) {
            query += ' AND (filename LIKE ? OR original_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error fetching media items' });
    }
};

// Helper: Upload file to Cloudflare R2 Storage or Local Disk fallback
async function saveMediaFile(file) {
    const folderPath = 'chatbot-media';
    const filename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${folderPath}/${filename}`;

    let publicUrl = '';
    let isStorageSuccess = false;

    try {
        const uploadResult = await storageService.uploadObject({
            key: storagePath,
            body: file.buffer,
            contentType: file.mimetype
        });
        publicUrl = uploadResult.publicUrl;
        isStorageSuccess = true;
    } catch (r2Err) {
        console.warn('[R2 UPLOAD WARN] Falling back to local disk:', r2Err.message);
    }

    if (!isStorageSuccess) {
        const uploadDir = path.join(__dirname, '../../uploads/chatbot-media');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const localPath = path.join(uploadDir, filename);
        fs.writeFileSync(localPath, file.buffer);
        publicUrl = `/uploads/chatbot-media/${filename}`;
    }

    let fileType = 'other';
    if (file.mimetype.startsWith('image/')) fileType = 'image';
    else if (file.mimetype.startsWith('video/')) fileType = 'video';
    else if (file.mimetype.startsWith('audio/')) fileType = 'audio';
    else if (file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('text')) fileType = 'document';

    return {
        filename,
        original_name: file.originalname,
        file_url: publicUrl,
        file_type: fileType,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_path: storagePath
    };
}

// 18. Upload media endpoint
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filesToProcess = req.files || [req.file];
        const insertedMedia = [];

        for (const file of filesToProcess) {
            const isVideo = (file.mimetype && file.mimetype.startsWith('video/')) || (file.originalname && file.originalname.toLowerCase().endsWith('.mp4'));
            if (isVideo && file.size > 16 * 1024 * 1024) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                return res.status(400).json({
                    message: `Video file "${file.originalname}" is ${sizeMb}MB, which exceeds WhatsApp's 16MB limit. Please compress the video file under 16MB and try again.`
                });
            }
        }

        for (const file of filesToProcess) {
            const mediaInfo = await saveMediaFile(file);
            const [result] = await pool.query(`
                INSERT INTO chatbot_media 
                (filename, original_name, file_url, file_type, mime_type, size_bytes, storage_path, associated_product_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                mediaInfo.filename,
                mediaInfo.original_name,
                mediaInfo.file_url,
                mediaInfo.file_type,
                mediaInfo.mime_type,
                mediaInfo.size_bytes,
                mediaInfo.storage_path,
                req.body.associated_product_id || null
            ]);

            insertedMedia.push({
                id: result.insertId,
                ...mediaInfo,
                associated_product_id: req.body.associated_product_id || null
            });
        }

        res.status(201).json(insertedMedia);
    } catch (err) {
        console.error('[UPLOAD MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error uploading media file' });
    }
};

// 19. Delete media
exports.deleteMedia = async (req, res) => {
    try {
        const mediaId = req.params.id;
        const [rows] = await pool.query('SELECT * FROM chatbot_media WHERE id = ?', [mediaId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Media not found' });

        const media = rows[0];
        // 1. Hard Delete from Cloudflare R2 Storage
        if (media.storage_path) {
            try {
                await storageService.deleteObject({ key: media.storage_path });
            } catch (e) {
                console.warn('[R2 HARD DELETE WARN]', e.message);
            }
        }

        // 2. Hard Delete from Local Disk if stored locally
        if (media.file_url && media.file_url.startsWith('/uploads/')) {
            try {
                const uploadsDir = path.resolve(__dirname, '../../uploads');
                const localPath = path.resolve(__dirname, '../..', media.file_url.replace(/^\//, ''));
                if (localPath.startsWith(uploadsDir) && fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
            } catch (e) {
                console.warn('[LOCAL DISK HARD DELETE WARN]', e.message);
            }
        }

        // 3. Hard Delete Record from Database
        await pool.query('DELETE FROM chatbot_media WHERE id = ?', [mediaId]);
        res.json({ message: 'Media item permanently hard deleted', id: mediaId });
    } catch (err) {
        console.error('[DELETE MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error deleting media' });
    }
};

// 20. Get storage usage stats
exports.getStorageUsage = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                COUNT(*) as total_files, 
                COALESCE(SUM(size_bytes), 0) as used_bytes 
            FROM chatbot_media
        `);

        const usedBytes = parseInt(rows[0].used_bytes) || 0;
        const totalFiles = parseInt(rows[0].total_files) || 0;
        const totalCapacityBytes = 5 * 1024 * 1024 * 1024; // 5 GB limit

        const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
        const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        const totalGB = 5;
        const percentage = Math.min(100, parseFloat(((usedBytes / totalCapacityBytes) * 100).toFixed(1)));

        res.json({
            used_bytes: usedBytes,
            total_bytes: totalCapacityBytes,
            used_mb: parseFloat(usedMB),
            used_gb: parseFloat(usedGB),
            total_gb: totalGB,
            percentage,
            total_files: totalFiles
        });
    } catch (err) {
        console.error('[GET STORAGE USAGE ERROR]', err);
        res.status(500).json({ message: 'Error calculating storage usage' });
    }
};

// 21. Get pending human handoff alerts (only show to assigned staff, admin, and whatsapp_manager)
exports.getPendingHumanAlerts = async (req, res) => {
    try {
        const userId = req.user ? (req.user.user_id || req.user.id) : null;
        const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';

        const isAdminUser = role === 'admin' || role === 'super-admin' || role.includes('admin');
        const isWhatsappManager = role === 'whatsapp_manager' || role.includes('whatsapp');

        // If not admin or whatsapp_manager, user must have a valid userId
        if (!isAdminUser && !isWhatsappManager && !userId) {
            return res.json([]);
        }

        // 1. Fetch active paused chatbot sessions
        const [pausedSessions] = await pool.query(`
            SELECT cs.session_id, cs.flow_id, cs.lead_id, cs.phone, cs.status as session_status, cs.paused_at, cs.current_node_key, cs.variables
            FROM chatbot_sessions cs
            WHERE cs.status = 'paused_for_human'
            ORDER BY cs.paused_at DESC, cs.session_id DESC
            LIMIT 50
        `);

        // 2. Fetch leads marked human_needed
        let leadSql = `
            SELECT l.lead_id, l.customer_name, l.phone_number, l.status as lead_status, l.assigned_to, l.score, l.city, l.updated_at
            FROM leads l
            WHERE l.status = 'human_needed'
        `;
        const leadParams = [];
        if (!isAdminUser && !isWhatsappManager) {
            // ONLY select leads assigned to this telecaller (do not include unassigned leads)
            leadSql += ` AND l.assigned_to = ?`;
            leadParams.push(userId);
        }
        leadSql += ` ORDER BY l.updated_at DESC, l.lead_id DESC LIMIT 50`;
        const [humanLeads] = await pool.query(leadSql, leadParams);

        // Map together into fast dictionary
        const alertsMap = new Map();

        for (const s of pausedSessions) {
            let vars = {};
            try { vars = typeof s.variables === 'string' ? JSON.parse(s.variables) : (s.variables || {}); } catch (e) {}
            const phoneClean = (s.phone || '').replace(/\D/g, '').slice(-10);

            const isCallSupport = !!(
                vars.is_call_support === true ||
                vars.call_support_requested === true ||
                vars.handoff_reason === 'Call Support' ||
                s.current_node_key === 'node-support-callback' ||
                s.current_node_key === 'node-support-ack'
            );

            alertsMap.set(s.session_id, {
                session_id: s.session_id,
                flow_id: s.flow_id,
                phone: s.phone,
                phoneClean,
                session_status: s.session_status,
                paused_at: s.paused_at,
                current_node_key: s.current_node_key,
                variables: s.variables,
                lead_id: s.lead_id || null,
                customer_name: null,
                lead_status: 'human_needed',
                assigned_to: null,
                score: null,
                city: null,
                last_message: null,
                is_call_support: isCallSupport,
                call_support_product: vars.call_support_product || 'SGB Blade Protector',
                call_support_requested_at: vars.call_support_requested_at || s.paused_at
            });
        }

        // Fill lead details for sessions
        for (const [sId, alert] of alertsMap) {
            let lead = null;
            if (alert.lead_id) {
                const [lRows] = await pool.query('SELECT lead_id, customer_name, phone_number, status, assigned_to, score, city FROM leads WHERE lead_id = ? LIMIT 1', [alert.lead_id]);
                if (lRows.length > 0) lead = lRows[0];
            } else if (alert.phoneClean) {
                const [lRows] = await pool.query('SELECT lead_id, customer_name, phone_number, status, assigned_to, score, city FROM leads WHERE phone_number LIKE ? LIMIT 1', [`%${alert.phoneClean}`]);
                if (lRows.length > 0) lead = lRows[0];
            }

            // For telecallers/staff (not admin or whatsapp_manager):
            // The lead MUST exist, MUST be assigned, and MUST match this user's ID.
            // If lead is unassigned or assigned to someone else, delete the alert immediately.
            if (!isAdminUser && !isWhatsappManager) {
                if (!lead || !lead.assigned_to || String(lead.assigned_to) !== String(userId)) {
                    alertsMap.delete(sId);
                    continue;
                }
            }

            if (lead) {
                alert.lead_id = lead.lead_id;
                alert.customer_name = lead.customer_name;
                alert.lead_status = lead.status;
                alert.assigned_to = lead.assigned_to;
                alert.score = lead.score;
                alert.city = lead.city;
            } else if (!isAdminUser && !isWhatsappManager) {
                alertsMap.delete(sId);
            }
        }

        // Add human_needed leads that aren't already represented
        for (const hl of humanLeads) {
            if (!isAdminUser && !isWhatsappManager) {
                if (!hl.assigned_to || String(hl.assigned_to) !== String(userId)) {
                    continue;
                }
            }

            const hlPhoneClean = (hl.phone_number || '').replace(/\D/g, '').slice(-10);
            const exists = Array.from(alertsMap.values()).some(a => a.lead_id === hl.lead_id || (hlPhoneClean && a.phoneClean === hlPhoneClean));
            if (!exists) {
                // Check latest session or pending callback followup for this lead to accurately classify Call Support
                const [[latestSession]] = await pool.query(
                    'SELECT session_id, flow_id, current_node_key, variables, paused_at FROM chatbot_sessions WHERE (lead_id = ? OR phone LIKE ?) ORDER BY session_id DESC LIMIT 1',
                    [hl.lead_id, `%${hlPhoneClean}`]
                );
                let leadIsCallSupport = false;
                let sVars = {};
                if (latestSession) {
                    try { sVars = typeof latestSession.variables === 'string' ? JSON.parse(latestSession.variables) : (latestSession.variables || {}); } catch (e) {}
                    if (sVars.is_call_support || sVars.call_support_requested || sVars.handoff_reason === 'Call Support' || latestSession.current_node_key === 'node-support-callback' || latestSession.current_node_key === 'node-support-ack') {
                        leadIsCallSupport = true;
                    }
                }
                if (!leadIsCallSupport) {
                    const [[followupRow]] = await pool.query(
                        'SELECT followup_id FROM lead_followups WHERE lead_id = ? AND (remarks LIKE "%Call Support%" OR remarks LIKE "%callback%") AND status = "pending" LIMIT 1',
                        [hl.lead_id]
                    );
                    if (followupRow) leadIsCallSupport = true;
                }

                alertsMap.set(`lead_${hl.lead_id}`, {
                    session_id: latestSession ? latestSession.session_id : null,
                    flow_id: latestSession ? latestSession.flow_id : null,
                    phone: hl.phone_number,
                    phoneClean: hlPhoneClean,
                    session_status: 'paused_for_human',
                    paused_at: (latestSession && latestSession.paused_at) ? latestSession.paused_at : hl.updated_at,
                    current_node_key: latestSession ? latestSession.current_node_key : null,
                    variables: sVars,
                    lead_id: hl.lead_id,
                    customer_name: hl.customer_name,
                    lead_status: hl.status,
                    assigned_to: hl.assigned_to,
                    score: hl.score,
                    city: hl.city,
                    last_message: null,
                    is_call_support: leadIsCallSupport,
                    call_support_product: sVars.call_support_product || 'SGB Blade Protector',
                    call_support_requested_at: (latestSession && latestSession.paused_at) ? latestSession.paused_at : hl.updated_at
                });
            }
        }

        // Fill last_message for alerts and verify support callback text
        for (const [key, alert] of alertsMap) {
            if (alert.lead_id) {
                const [cmRows] = await pool.query(
                    'SELECT message FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.session_id WHERE cs.lead_id = ? ORDER BY cm.chat_id DESC LIMIT 1',
                    [alert.lead_id]
                );
                if (cmRows.length > 0) {
                    alert.last_message = cmRows[0].message;
                }
            }
            if (!alert.is_call_support && alert.last_message && (
                alert.last_message.toLowerCase().includes('support callback request') ||
                alert.last_message.toLowerCase().includes('callback request has been registered')
            )) {
                alert.is_call_support = true;
            }
        }

        let results = Array.from(alertsMap.values());

        // Final strict gate: non-admin and non-whatsapp-manager users only receive alerts for their assigned leads
        if (!isAdminUser && !isWhatsappManager) {
            results = results.filter(alert => alert.assigned_to && String(alert.assigned_to) === String(userId));
        }

        res.json(results);
    } catch (err) {
        console.error('[GET PENDING HUMAN ALERTS ERROR]', err);
        res.status(500).json({ message: 'Error fetching human handoff alerts' });
    }
};

// 22. Re-trigger chatbot flow session for a customer
exports.retriggerFlowSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.retriggerSession(identifier);
        res.json({ message: 'Chatbot flow re-triggered successfully', ...result });
    } catch (err) {
        console.error('[RETRIGGER FLOW ERROR]', err);
        res.status(500).json({ message: err.message || 'Error re-triggering flow session' });
    }
};

// 23. Takeover chatbot flow session (pause bot for manual agent chat)
exports.takeoverFlowSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.takeoverSession(identifier);
        res.json({ message: 'Bot paused for human takeover successfully', ...result });
    } catch (err) {
        console.error('[TAKEOVER FLOW ERROR]', err);
        res.status(500).json({ message: err.message || 'Error taking over flow session' });
    }
};

// 24. Resolve human handoff for a customer or session
exports.resolveHandoffSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.resolveHandoff(identifier);
        res.json({ message: 'Handoff resolved successfully', ...result });
    } catch (err) {
        console.error('[RESOLVE HANDOFF ERROR]', err);
        res.status(500).json({ message: err.message || 'Error resolving handoff session' });
    }
};

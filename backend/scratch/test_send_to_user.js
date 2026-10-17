const whatsappService = require('../src/services/whatsapp.service');

async function testSend() {
    try {
        console.log('Testing sending text message to 6364594854...');
        const res = await whatsappService.sendMessage('6364594854', '📋 *Test Form Prompt*\n\nPlease reply with your details.', null, -1);
        console.log('Result:', res);
    } catch (err) {
        console.error('Send error:', err.response ? err.response.data : err);
    }
}


testSend();

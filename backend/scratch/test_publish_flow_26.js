const pool = require('../src/config/db');
const chatbotController = require('../src/controllers/chatbot.controller');

(async () => {
    try {
        console.log('Testing publishFlow for Flow ID 26...');
        const req = { params: { flowId: 26 }, user: { id: 1 } };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(data) {
                console.log(`RESPONSE (${this.statusCode}):`, JSON.stringify(data, null, 2));
            }
        };

        await chatbotController.publishFlow(req, res);
        process.exit(0);
    } catch (err) {
        console.error('Publish error:', err);
        process.exit(1);
    }
})();

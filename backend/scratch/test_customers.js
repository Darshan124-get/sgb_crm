const messageService = require('../src/services/message.service');

async function test() {
    try {
        console.log('Testing getAllChatCustomers...');
        const result = await messageService.getAllChatCustomers({ role: 'admin', id: 1 }, { limit: 50, page: 1, tab: 'all' });
        console.log('SUCCESS! Customers count:', result.customers.length, 'Total:', result.totalCount);
    } catch (err) {
        console.error('ERROR IN getAllChatCustomers:', err);
    }
    process.exit(0);
}

test();

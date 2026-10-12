const db = require('../backend/src/config/db');
const customerSupportService = require('../backend/src/services/customer_support.service');

async function testWorkflow() {
    console.log('--- Testing Delivery Event Integration ---');

    // 1. Find a B2C order (order_source = 'lead')
    const [b2cOrders] = await db.query("SELECT order_id, customer_name, order_source, dealer_id FROM orders WHERE order_source = 'lead' LIMIT 1");
    if (b2cOrders.length === 0) {
        console.log('No B2C order found to test with.');
        return;
    }
    const testB2c = b2cOrders[0];
    console.log(`Testing with B2C Order #${testB2c.order_id} (${testB2c.customer_name})`);

    // First call: Should create case
    const res1 = await customerSupportService.handleOrderDelivered(testB2c.order_id);
    console.log('First delivery event result:', res1);

    // Second call: Should return alreadyExists without duplicate
    const res2 = await customerSupportService.handleOrderDelivered(testB2c.order_id);
    console.log('Second delivery event (repeat) result:', res2);

    // Verify in database
    const [cases] = await db.query('SELECT * FROM customer_support_cases WHERE order_id = ?', [testB2c.order_id]);
    console.log(`Found ${cases.length} case(s) for Order #${testB2c.order_id}: Case #${cases[0]?.case_number}`);

    // Verify B2B order exclusion
    const [b2bOrders] = await db.query("SELECT order_id FROM orders WHERE order_source = 'dealer' LIMIT 1");
    if (b2bOrders.length > 0) {
        const testB2b = b2bOrders[0];
        console.log(`Testing with B2B dealer Order #${testB2b.order_id}`);
        const resB2b = await customerSupportService.handleOrderDelivered(testB2b.order_id);
        console.log('B2B order result (should be excluded):', resB2b);
        const [b2bCases] = await db.query('SELECT * FROM customer_support_cases WHERE order_id = ?', [testB2b.order_id]);
        console.log(`B2B cases count (should be 0): ${b2bCases.length}`);
    }

    console.log('--- Test Finished ---');
    process.exit(0);
}

testWorkflow().catch(e => {
    console.error(e);
    process.exit(1);
});

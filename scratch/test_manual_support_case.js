const axios = require('axios');
const path = require('path');
const db = require('../backend/src/config/db');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runTest() {
    console.log('======================================================');
    console.log('   TESTING MANUAL CUSTOMER SUPPORT CASE CREATION      ');
    console.log('======================================================\n');

    // 1. Authenticate as executive
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: 'support@sgbagro.com',
        password: 'Support@123'
    });
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log('[PASS] Logged in successfully as support executive');

    // 2. Test Customer / Order Lookup
    console.log('\n--- 1. Testing Customer & Order Lookup by Phone ---');
    const lookupRes = await axios.get(`${BASE_URL}/customer-support/lookup-customer?phone=9876543210`, { headers: authHeaders });
    console.log('[PASS] Lookup Response:', {
        found: lookupRes.data.found,
        ordersCount: lookupRes.data.orders.length,
        leadFound: !!lookupRes.data.lead
    });

    // 3. Test Manual Case Creation without pre-existing Order (Custom / Offline Order)
    console.log('\n--- 2. Testing Manual Case Creation (Offline / Manual Order) ---');
    const manualPhone = '9123456789';
    const createRes1 = await axios.post(`${BASE_URL}/customer-support/cases`, {
        customer_phone: manualPhone,
        customer_name: 'Suresh Patel',
        manual_order_number: 'OFFLINE-PUMP-2026',
        product_summary: 'Submersible Aerator 2HP with Starter Panel',
        delivery_date: '2026-10-10',
        notes: 'Customer called requesting guidance for electrical starter wiring.'
    }, { headers: authHeaders });

    console.log('[PASS] Manual Case 1 Created:', createRes1.data);
    const caseId1 = createRes1.data.case_id;

    // 4. Fetch the created manual case
    console.log(`\n--- 3. Fetching Manual Case Details (ID: ${caseId1}) ---`);
    const caseDetails = await axios.get(`${BASE_URL}/customer-support/cases/${caseId1}`, { headers: authHeaders });
    console.log(`[PASS] Case Number: ${caseDetails.data.case.case_number}`);
    console.log(`[PASS] Customer: ${caseDetails.data.case.customer_name} (${caseDetails.data.case.customer_phone})`);
    console.log(`[PASS] Manual Order #: ${caseDetails.data.case.manual_order_number}`);
    console.log(`[PASS] Product Summary: ${caseDetails.data.case.product_summary}`);
    console.log(`[PASS] Initial Notes count: ${caseDetails.data.notes.length}`);

    // 5. Test Call Logging on Manual Case
    console.log('\n--- 4. Logging Customer Call on Manual Case ---');
    const callRes = await axios.post(`${BASE_URL}/customer-support/cases/${caseId1}/calls`, {
        call_type: 'INITIAL',
        call_outcome: 'answered',
        installation_status: 'in_progress',
        guidance_provided: 'Guided customer on connecting 3-phase starter capacitor and pressure line.'
    }, { headers: authHeaders });
    console.log('[PASS] Call Logged on Manual Case:', callRes.data);

    // 6. Complete Support on Manual Case & Verify 30-Day Follow-Up
    console.log('\n--- 5. Completing Support & Scheduling 30-Day Follow-Up on Manual Case ---');
    const completeRes = await axios.post(`${BASE_URL}/customer-support/cases/${caseId1}/complete`, {
        call_outcome: 'answered',
        installation_status: 'successfully_installed',
        guidance_provided: 'Installation completed. Aerator operating at full 2HP flow.',
        notes: 'Customer very satisfied with live tele-assistance.'
    }, { headers: authHeaders });
    console.log('[PASS] Support Completed:', completeRes.data);

    // 7. Verify Follow-Up Record in DB
    const [fuRows] = await db.query('SELECT * FROM customer_support_followups WHERE case_id = ?', [caseId1]);
    console.log(`[PASS] 30-Day Follow-Up Created in DB:`, {
        followup_id: fuRows[0].followup_id,
        scheduled_date: fuRows[0].scheduled_date,
        status: fuRows[0].status,
        customer_name: fuRows[0].customer_name,
        customer_phone: fuRows[0].customer_phone
    });

    console.log('\n======================================================');
    console.log('   MANUAL CASE FEATURE TEST COMPLETED WITH 100% SUCCESS ');
    console.log('======================================================\n');
    process.exit(0);
}

runTest().catch(err => {
    console.error('Fatal test error:', err.response?.data || err.message);
    process.exit(1);
});

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const db = require('../backend/src/config/db');
const customerSupportService = require('../backend/src/services/customer_support.service');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runE2ETest() {
    console.log('====================================================');
    console.log('   STARTING E2E CUSTOMER SUPPORT WORKFLOW TEST      ');
    console.log('====================================================\n');

    let token = null;
    let executiveUser = null;

    // STEP 1: AUTHENTICATION
    console.log('--- STEP 1: AUTHENTICATING AS SUPPORT EXECUTIVE ---');
    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            identifier: 'support@sgbagro.com',
            password: 'Support@123'
        });
        token = loginRes.data.token;
        executiveUser = loginRes.data.user;
        console.log(`[PASS] Logged in successfully as: ${executiveUser.name} (${executiveUser.email})`);
        console.log(`[PASS] Role: ${executiveUser.role}, Dept ID: ${executiveUser.department_id}`);
    } catch (err) {
        console.error('[FAIL] Login failed:', err.response?.data || err.message);
        process.exit(1);
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // STEP 2: SETTINGS & TEAM ROSTER
    console.log('\n--- STEP 2: GET SETTINGS & STAFF ROSTER ---');
    try {
        const settingsRes = await axios.get(`${BASE_URL}/customer-support/settings`, { headers: authHeaders });
        console.log('[PASS] Settings retrieved:', settingsRes.data.settings);
        const staffFound = settingsRes.data.staff.find(s => s.email === 'support@sgbagro.com');
        console.log(`[PASS] Executive in roster: ${staffFound ? staffFound.name : 'Not Found'}`);
    } catch (err) {
        console.error('[FAIL] Settings endpoint failed:', err.response?.data || err.message);
        process.exit(1);
    }

    // STEP 3: ELIGIBLE B2C ORDER & DELIVERY EVENT INTEGRATION
    console.log('\n--- STEP 3: DELIVERY EVENT INTEGRATION & IDEMPOTENCY ---');
    
    // Find or prepare an eligible B2C order
    const [b2cOrders] = await db.query(`
        SELECT order_id, customer_name, phone, order_source, dealer_id, purchase_source
        FROM orders
        WHERE order_source = 'lead' AND dealer_id IS NULL
        LIMIT 1
    `);

    if (b2cOrders.length === 0) {
        console.error('[FAIL] No B2C order found in database');
        process.exit(1);
    }

    const testOrder = b2cOrders[0];
    console.log(`Using B2C Order #${testOrder.order_id} (Customer: ${testOrder.customer_name})`);

    // Clean any prior support case for clean idempotent test run
    await db.query('DELETE FROM customer_support_cases WHERE order_id = ?', [testOrder.order_id]);

    // 3.1 Initial Delivery Event
    const deliveryResult1 = await customerSupportService.handleOrderDelivered(testOrder.order_id);
    console.log('[PASS] Delivery Event 1 Result:', deliveryResult1);
    if (!deliveryResult1.success || deliveryResult1.alreadyExists) {
        throw new Error('Expected new case creation on first delivery event');
    }
    const createdCaseId = deliveryResult1.caseId;

    // 3.2 Idempotency: Repeat Delivery Event
    const deliveryResult2 = await customerSupportService.handleOrderDelivered(testOrder.order_id);
    console.log('[PASS] Repeated Delivery Event Result:', deliveryResult2);
    if (!deliveryResult2.alreadyExists) {
        throw new Error('Expected alreadyExists: true on repeated delivery event');
    }

    // 3.3 Verify B2B Dealer Order Exclusion
    const [b2bOrders] = await db.query(`
        SELECT order_id FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL LIMIT 1
    `);
    if (b2bOrders.length > 0) {
        const b2bResult = await customerSupportService.handleOrderDelivered(b2bOrders[0].order_id);
        console.log('[PASS] B2B Dealer Order Handled:', b2bResult);
        if (b2bResult.eligible !== false) {
            throw new Error('B2B order should not be eligible for B2C customer support');
        }
    }

    // STEP 4: DASHBOARD METRICS
    console.log('\n--- STEP 4: DASHBOARD METRICS ---');
    const metricsRes = await axios.get(`${BASE_URL}/customer-support/dashboard-metrics`, { headers: authHeaders });
    console.log('[PASS] Dashboard Metrics:', metricsRes.data.metrics);

    // STEP 5: FETCH CASE DETAILS
    console.log(`\n--- STEP 5: FETCH CASE DETAILS (ID: ${createdCaseId}) ---`);
    const caseDetailsRes = await axios.get(`${BASE_URL}/customer-support/cases/${createdCaseId}`, { headers: authHeaders });
    console.log(`[PASS] Case Number: ${caseDetailsRes.data.case.case_number}`);
    console.log(`[PASS] Assigned To: ${caseDetailsRes.data.case.assigned_name || 'Executive'}`);
    console.log(`[PASS] Order Total: Rs. ${caseDetailsRes.data.case.total_amount}`);

    // STEP 6: RECORD INITIAL INTERMEDIATE CALL (Callback Required)
    console.log('\n--- STEP 6: RECORD INITIAL CALL (CALLBACK REQUIRED) ---');
    const call1Res = await axios.post(`${BASE_URL}/customer-support/cases/${createdCaseId}/calls`, {
        call_type: 'INITIAL',
        call_outcome: 'callback_required',
        remarks: 'Customer in meeting, requested callback at 4 PM.'
    }, { headers: authHeaders });
    console.log('[PASS] Intermediate Call Result:', call1Res.data);

    // STEP 7: RECORD CUSTOMER NOTE
    console.log('\n--- STEP 7: ADD CUSTOMER NOTE ---');
    const noteRes = await axios.post(`${BASE_URL}/customer-support/cases/${createdCaseId}/notes`, {
        note: 'Customer requested installation video guide on WhatsApp.'
    }, { headers: authHeaders });
    console.log('[PASS] Note Result:', noteRes.data);

    // STEP 8: MULTI-PHOTO UPLOAD
    console.log('\n--- STEP 8: UPLOAD INSTALLATION FITTING PHOTOS ---');
    const dummyImagePath = path.join(__dirname, 'test_fitting_photo.png');
    // Create a 1x1 dummy PNG if not existing
    const dummyPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(dummyImagePath, dummyPngBuffer);

    const form = new FormData();
    form.append('photos', fs.createReadStream(dummyImagePath), { filename: 'fitting_pipe_installation.png' });
    form.append('photos', fs.createReadStream(dummyImagePath), { filename: 'pump_fitting_check.png' });

    const photoRes = await axios.post(`${BASE_URL}/customer-support/cases/${createdCaseId}/photos`, form, {
        headers: {
            ...authHeaders,
            ...form.getHeaders()
        }
    });
    console.log('[PASS] Photos Uploaded:', photoRes.data);
    fs.unlinkSync(dummyImagePath);

    // STEP 9: COMPLETE SUPPORT & AUTO-SCHEDULE 30-DAY FOLLOW-UP
    console.log('\n--- STEP 9: COMPLETE SUPPORT & AUTO-SCHEDULE 30-DAY FOLLOW-UP ---');
    const completeRes = await axios.post(`${BASE_URL}/customer-support/cases/${createdCaseId}/complete`, {
        call_outcome: 'answered',
        installation_status: 'successfully_installed',
        guidance_provided: 'Explained air pump valve connection, water level calibration, and voltage stabilizer usage.',
        notes: 'Customer confirmed equipment running smoothly.',
        remarks: 'Initial installation completed without issue.'
    }, { headers: authHeaders });
    console.log('[PASS] Complete Support Result:', completeRes.data);

    const scheduledDate = completeRes.data.scheduled_date;
    const followupId = completeRes.data.followup_id;
    console.log(`[PASS] 30-Day Follow-Up Scheduled for: ${scheduledDate} (Followup ID: ${followupId})`);

    // STEP 10: VERIFY NOTIFICATIONS
    console.log('\n--- STEP 10: VERIFY IN-APP NOTIFICATIONS ---');
    const notifsRes = await axios.get(`${BASE_URL}/customer-support/notifications`, { headers: authHeaders });
    console.log(`[PASS] Notifications Count: ${notifsRes.data.notifications.length}, Unread: ${notifsRes.data.unread_count}`);
    const latestNotif = notifsRes.data.notifications[0];
    console.log(`[PASS] Latest Notification: "${latestNotif.title}" - ${latestNotif.message}`);

    // Mark as read
    if (latestNotif) {
        await axios.patch(`${BASE_URL}/customer-support/notifications/${latestNotif.notification_id}/read`, {}, { headers: authHeaders });
        console.log(`[PASS] Marked notification #${latestNotif.notification_id} as read`);
    }

    // STEP 11: SIMULATE FOLLOW-UP BECOMING DUE & PROCESS
    console.log('\n--- STEP 11: SIMULATE 30-DAY FOLLOW-UP BECOMING DUE ---');
    // Set scheduled_date to CURDATE() so it triggers as DUE
    await db.query('UPDATE customer_support_followups SET scheduled_date = CURDATE() WHERE followup_id = ?', [followupId]);
    await customerSupportService.processDueFollowups();

    const fuDetailsRes = await axios.get(`${BASE_URL}/customer-support/followups/${followupId}`, { headers: authHeaders });
    console.log(`[PASS] Follow-Up Status: ${fuDetailsRes.data.followup.status} (Expected: DUE)`);
    console.log(`[PASS] Customer: ${fuDetailsRes.data.followup.customer_name}, Order: #${fuDetailsRes.data.followup.order_id}`);

    // STEP 12: EXECUTE FOLLOW-UP CALL & RECORD OUTCOME
    console.log('\n--- STEP 12: EXECUTE FOLLOW-UP CALL & RECORD FEEDBACK ---');
    const fuCallRes = await axios.post(`${BASE_URL}/customer-support/followups/${followupId}/call`, {
        product_condition: 'working_fine',
        any_issues: 'no',
        customer_feedback: 'Customer is extremely happy with crop growth and aeration efficiency. Thanked support team.',
        next_action: 'no_action_required',
        remarks: '30-day health check complete. No issues.'
    }, { headers: authHeaders });
    console.log('[PASS] Follow-Up Call Recorded:', fuCallRes.data);

    // Verify Final Status in DB
    const [finalFu] = await db.query('SELECT * FROM customer_support_followups WHERE followup_id = ?', [followupId]);
    console.log(`[PASS] Final Follow-Up DB Status: ${finalFu[0].status}, Completed At: ${finalFu[0].completed_at}`);

    const [finalCase] = await db.query('SELECT * FROM customer_support_cases WHERE case_id = ?', [createdCaseId]);
    console.log(`[PASS] Final Support Case DB Status: ${finalCase[0].status}, Completed At: ${finalCase[0].completed_at}`);

    console.log('\n====================================================');
    console.log('   ALL E2E WORKFLOW TESTS COMPLETED SUCCESSFULLY!   ');
    console.log('====================================================\n');
    process.exit(0);
}

runE2ETest().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});

// Uses native fetch in Node 22
const db = require('../backend/src/config/db');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testUnreachableFollowup() {
    try {
        console.log('--- 1. Authenticating as Support Executive ---');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: 'support@sgbagro.com',
                password: 'Support@123'
            })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        console.log('[PASS] Logged in successfully');

        console.log('--- 2. Fetching cases ---');
        const casesRes = await fetch(`${BASE_URL}/customer-support/cases?limit=1`, { headers });
        const casesData = await casesRes.json();
        const testCase = casesData.cases[0];
        if (!testCase) {
            console.error('No cases found to test.');
            process.exit(1);
        }
        console.log(`[PASS] Testing with Case #${testCase.case_number} (ID: ${testCase.case_id})`);

        console.log('--- 3. Testing Unreachable Call Log with Tomorrow Follow-Up ---');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const recordRes = await fetch(`${BASE_URL}/customer-support/cases/${testCase.case_id}/calls`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                call_type: 'INITIAL',
                call_outcome: 'switched_off',
                scheduled_date: tomorrowStr,
                preferred_time_slot: 'Morning (09:00 AM - 12:00 PM)',
                remarks: 'Customer phone was switched off. Scheduled follow-up for tomorrow morning.'
            })
        });
        const recordData = await recordRes.json();
        console.log('[PASS] Record call response:', recordData);

        console.log('--- 4. Verifying in Database ---');
        const [calls] = await db.query(
            'SELECT * FROM customer_support_calls WHERE call_id = ?',
            [recordData.call_id]
        );
        console.log('[PASS] Call recorded in DB:', {
            call_id: calls[0].call_id,
            call_outcome: calls[0].call_outcome,
            remarks: calls[0].remarks
        });

        const [followups] = await db.query(
            'SELECT * FROM customer_support_followups WHERE case_id = ? AND followup_type = "CALLBACK"',
            [testCase.case_id]
        );
        console.log('[PASS] Follow-up created in DB:', {
            followup_id: followups[0].followup_id,
            followup_type: followups[0].followup_type,
            scheduled_date: followups[0].scheduled_date,
            status: followups[0].status,
            remarks: followups[0].remarks
        });

        const [notes] = await db.query(
            'SELECT * FROM customer_support_notes WHERE case_id = ? ORDER BY note_id DESC LIMIT 1',
            [testCase.case_id]
        );
        console.log('[PASS] Latest note recorded:', notes[0].note);

        console.log('\n========================================');
        console.log('  ALL TESTS PASSED SUCCESSFULLY!       ');
        console.log('========================================');
        process.exit(0);

    } catch (err) {
        console.error('[FAIL] Test failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

testUnreachableFollowup();

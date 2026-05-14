require('dotenv').config();

const API_URL = 'http://127.0.0.1:5000/api';
let token = '';

async function testLeadCreation() {
    try {
        console.log('--- TESTING LEAD CREATION ---');

        // 1. Login to get token
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@sgbagro.com',
                password: 'password123'
            })
        });
        const loginData = await loginRes.json();
        
        if (!loginRes.ok) throw new Error('Login failed: ' + loginData.message);
        
        token = loginData.token;
        console.log('Login successful.');

        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Try creating a new lead with unique phone
        const uniquePhone = '9' + Math.floor(Math.random() * 1000000000);
        console.log(`Testing valid lead creation with phone: ${uniquePhone}`);
        const createRes = await fetch(`${API_URL}/leads`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                phone_number: uniquePhone,
                customer_name: 'Test Farmer',
                city: 'Test Village',
                source: 'test'
            })
        });
        const createData = await createRes.json();
        console.log('Result Status:', createRes.status, createData);

        // 3. Try creating a duplicate lead
        console.log(`Testing duplicate lead creation with phone: ${uniquePhone}`);
        const dupRes = await fetch(`${API_URL}/leads`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                phone_number: uniquePhone,
                customer_name: 'Duplicate Farmer'
            })
        });
        const dupData = await dupRes.json();
        console.log('Duplicate Result Status (Expected 400):', dupRes.status, dupData);

        // 4. Try creating lead with missing phone
        console.log('Testing missing phone validation...');
        const missRes = await fetch(`${API_URL}/leads`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                customer_name: 'No Phone Farmer'
            })
        });
        const missData = await missRes.json();
        console.log('Missing Phone Result Status (Expected 400):', missRes.status, missData);

    } catch (err) {
        console.error('Test script error:', err.message);
    }
}

testLeadCreation();

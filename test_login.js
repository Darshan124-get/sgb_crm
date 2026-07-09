const fetch = require('node-fetch');

async function testLogin() {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'testbilling', password: 'zero permission' })
    });
    
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
}
testLogin();

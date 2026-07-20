const axios = require('axios');

async function run() {
  try {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '123456789',
                  phone_number_id: '123456789'
                },
                contacts: [{ profile: { name: 'Test User' }, wa_id: '916364594854' }],
                messages: [
                  {
                    from: '916364594854',
                    id: 'wamid.HBgLOTE2MzY0NTk0ODU0FQIAEhgUM0E1RDBCNDNBNTlCODBGMzdFOTIA',
                    timestamp: '1690000000',
                    text: { body: 'hi' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    const res = await axios.post('http://localhost:5000/webhook', payload);
    console.log('Webhook Response:', res.status, res.data);
  } catch (err) {
    console.error('Webhook Error:', err.response ? err.response.data : err.message);
  }
}

run();

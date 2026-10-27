require('dotenv').config();
const axios = require('axios');

async function uploadFlowJson() {
    const token = process.env.WHATSAPP_TOKEN;
    const flowId = '1471575221542737';

    const flowJson = {
        version: '3.1',
        screens: [
            {
                id: 'DELIVERY_DETAILS',
                title: 'Delivery Details',
                data: {},
                terminal: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        {
                            type: 'Form',
                            name: 'delivery_form',
                            children: [
                                {
                                    type: 'TextInput',
                                    name: 'customer_name',
                                    label: 'Full Name',
                                    required: true,
                                    'input-type': 'text'
                                },
                                {
                                    type: 'TextArea',
                                    name: 'delivery_address',
                                    label: 'Delivery Address',
                                    required: true,
                                    'helper-text': 'House no, Street, Village/Town'
                                },
                                {
                                    type: 'TextInput',
                                    name: 'pincode',
                                    label: 'PIN Code',
                                    required: true,
                                    'input-type': 'number',
                                    'helper-text': '6-digit PIN Code'
                                },
                                {
                                    type: 'CheckboxGroup',
                                    name: 'address_confirmed',
                                    title: 'Address Confirmation',
                                    required: true,
                                    'data-source': [
                                        {
                                            id: 'confirmed',
                                            title: 'I confirm my delivery details are correct'
                                        }
                                    ]
                                },
                                {
                                    type: 'Footer',
                                    label: 'Submit Details',
                                    'on-click-action': {
                                        name: 'complete',
                                        payload: {
                                            customer_name: '${form.customer_name}',
                                            delivery_address: '${form.delivery_address}',
                                            pincode: '${form.pincode}',
                                            address_confirmed: '${form.address_confirmed}'
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    };

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const parts = [
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="name"\r\n\r\nflow.json\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="asset_type"\r\n\r\nFLOW_JSON\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="flow.json"\r\nContent-Type: application/json\r\n\r\n'),
        Buffer.from(JSON.stringify(flowJson)),
        Buffer.from('\r\n--' + boundary + '--\r\n')
    ];
    const payload = Buffer.concat(parts);

    try {
        const res = await axios.post(`https://graph.facebook.com/v21.0/${flowId}/assets`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        });
        console.log('Upload Result:', res.data);

        // Publish flow
        console.log('Publishing Flow...');
        const pubRes = await axios.post(`https://graph.facebook.com/v21.0/${flowId}/publish`, {}, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('Publish Result:', pubRes.data);
    } catch (e) {
        console.error('Meta API Error:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
}

uploadFlowJson().catch(console.error);

require('dotenv').config();
const axios = require('axios');

async function uploadFlowV6() {
    const token = process.env.WHATSAPP_TOKEN;
    const flowId = '1471575221542737';

    const flowJson = {
        version: '6.0',
        screens: [
            {
                id: 'DELIVERY_DETAILS',
                title: 'Delivery Details',
                terminal: true,
                data: {},
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        {
                            type: 'Form',
                            name: 'form',
                            children: [
                                {
                                    type: 'TextHeading',
                                    text: 'Enter Your Delivery Details'
                                },
                                {
                                    type: 'TextSubheading',
                                    text: 'For SGB Blade Protector Order (₹600)'
                                },
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
                                    'helper-text': '6-digit postal code'
                                },
                                {
                                    type: 'CheckboxGroup',
                                    name: 'address_confirmed',
                                    label: 'Address Confirmation',
                                    required: true,
                                    'data-source': [
                                        {
                                            id: 'yes',
                                            title: 'I confirm the above delivery details are correct'
                                        }
                                    ]
                                },
                                {
                                    type: 'Footer',
                                    label: 'Submit Delivery Details',
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

    try {
        console.log('Uploading Flow JSON version 6.0...');
        const res = await axios.post(`https://graph.facebook.com/v21.0/${flowId}/assets`, Buffer.concat(parts), {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        });
        console.log('Upload Result:', JSON.stringify(res.data, null, 2));

        if (!res.data.validation_errors || res.data.validation_errors.length === 0) {
            console.log('Publishing Flow...');
            const pub = await axios.post(`https://graph.facebook.com/v21.0/${flowId}/publish`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Publish Result:', pub.data);
        }
    } catch (e) {
        console.error('Error:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
}

uploadFlowV6().catch(console.error);

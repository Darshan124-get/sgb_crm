require('dotenv').config();
const axios = require('axios');

async function testVersions() {
    const versions = ['6.0', '5.0', '4.0', '3.0', '2.1', '2.0'];
    const token = process.env.WHATSAPP_TOKEN;
    const flowId = '1471575221542737';

    for (const v of versions) {
        const flowJson = { version: v, screens: [{ id: 'TEST', title: 'Test', data: {}, layout: { type: 'SingleColumnLayout', children: [] } }] };
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const parts = [
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="name"\r\n\r\nflow.json\r\n'),
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="asset_type"\r\n\r\nFLOW_JSON\r\n'),
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="flow.json"\r\nContent-Type: application/json\r\n\r\n'),
            Buffer.from(JSON.stringify(flowJson)),
            Buffer.from('\r\n--' + boundary + '--\r\n')
        ];
        try {
            const res = await axios.post(`https://graph.facebook.com/v21.0/${flowId}/assets`, Buffer.concat(parts), {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
            });
            const errs = res.data.validation_errors || [];
            const verErr = errs.find(e => e.error === 'INVALID_FLOW_JSON_VERSION');
            console.log('Version', v, verErr ? 'INVALID' : 'VALID VERSION! Errors: ' + errs.map(e => e.error).join(', '));
            if (!verErr) return v;
        } catch (e) {
            console.log('Version', v, 'Req Error:', e.response?.data?.error?.message || e.message);
        }
    }
}

testVersions().catch(console.error);

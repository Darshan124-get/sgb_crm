const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({path:'d:/sgb scratch/backend/.env'});

async function run() {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'SGB_AGRO_SECRET_KEY');
    try {
        const res = await axios.get('http://127.0.0.1:5000/api/reports/campaign-analytics?campaign_id=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}
run();

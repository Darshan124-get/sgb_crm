const pool = require('../src/config/db');
const leadController = require('../src/controllers/lead.controller');

async function testTelecomLeads() {
    console.log("=== Testing Telecom Panel Leads & Stats for User 107 ===");

    // Mock request and response for user 107 (telecaller_executive)
    function mockReq(query = {}) {
        return {
            user: { id: 107, role: 'telecaller_executive' },
            query
        };
    }

    function mockRes() {
        return {
            statusCode: 200,
            data: null,
            status(code) { this.statusCode = code; return this; },
            json(val) { this.data = val; return this; }
        };
    }

    // 1. Test getStats
    const reqStats = mockReq();
    const resStats = mockRes();
    await leadController.getStats(reqStats, resStats);
    console.log("1. /api/leads/stats Response:", resStats.data);

    // 2. Test getLeads?is_today=true (Today tab)
    const reqToday = mockReq({ is_today: 'true' });
    const resToday = mockRes();
    await leadController.getLeads(reqToday, resToday);
    const todayLeads = resToday.data.leads || [];
    console.log(`2. /api/leads?is_today=true: returned ${todayLeads.length} leads`);
    todayLeads.forEach(l => {
        console.log(`   - [${l.lead_id}] ${l.customer_name} | status: ${l.status} | assigned_at: ${l.assigned_at} | created_at: ${l.created_at}`);
    });

    // 3. Test getLeads?status=new (New tab)
    const reqNew = mockReq({ status: 'new' });
    const resNew = mockRes();
    await leadController.getLeads(reqNew, resNew);
    const newLeads = resNew.data.leads || [];
    console.log(`3. /api/leads?status=new: returned ${newLeads.length} leads`);
    newLeads.forEach(l => {
        console.log(`   - [${l.lead_id}] ${l.customer_name} | status: ${l.status}`);
    });

    // 4. Test getLeads (All tab)
    const reqAll = mockReq({});
    const resAll = mockRes();
    await leadController.getLeads(reqAll, resAll);
    const allLeads = resAll.data.leads || [];
    console.log(`4. /api/leads (all): returned ${allLeads.length} leads`);

    process.exit(0);
}

testTelecomLeads().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});

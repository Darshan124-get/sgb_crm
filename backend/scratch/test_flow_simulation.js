const pool = require('../src/config/db');
const FlowEngine = require('../src/services/FlowEngine');

async function testSimulation() {
    try {
        console.log('=== TESTING CHATBOT FLOW ENGINE EXECUTION ===');

        const [flows] = await pool.query('SELECT flow_id, active_version_id FROM chatbot_flows WHERE name LIKE "%Full Set%" LIMIT 1');
        if (flows.length === 0) {
            console.error('No Full Set flow found');
            process.exit(1);
        }

        const flow = flows[0];
        console.log(`Testing Flow ID ${flow.flow_id}, Active Version ${flow.active_version_id}`);

        const testPhone = '9999999999';

        // Clean up previous test sessions
        await pool.query('DELETE FROM chatbot_sessions WHERE phone = ?', [testPhone]);
        await pool.query('DELETE FROM chatbot_executions WHERE session_id IN (SELECT session_id FROM chatbot_sessions WHERE phone = ?)', [testPhone]);

        console.log('\n--- Step 1: Incoming message "Chat with us" ---');
        await FlowEngine.handleMessage(testPhone, 'Chat with us');

        let [[sess]] = await pool.query('SELECT * FROM chatbot_sessions WHERE phone = ? AND status = "active"', [testPhone]);
        console.log(`Session after trigger: current_node_key = ${sess?.current_node_key}`);

        console.log('\n--- Step 2: Customer selects "Full Set" ---');
        await FlowEngine.handleMessage(testPhone, 'Full Set');
        [[sess]] = await pool.query('SELECT * FROM chatbot_sessions WHERE phone = ? AND status = "active"', [testPhone]);
        console.log(`Session after option 1: current_node_key = ${sess?.current_node_key}`);

        console.log('\n--- Step 3: Customer selects "1. Below 2 Acre" ---');
        await FlowEngine.handleMessage(testPhone, '1. Below 2 Acre');

        [[sess]] = await pool.query('SELECT * FROM chatbot_sessions WHERE phone = ? AND status = "active"', [testPhone]);
        console.log(`Session after product trigger: current_node_key = ${sess?.current_node_key}`);

        const [execs] = await pool.query('SELECT * FROM chatbot_executions WHERE session_id = ? ORDER BY id ASC', [sess.session_id]);
        console.log(`\nExecution Log Count for Session ${sess.session_id}: ${execs.length}`);
        const productExecs = execs.filter(e => e.node_key === 'node-4');
        console.log(`Product Node (node-4) Execution Count: ${productExecs.length}`);

        if (productExecs.length === 1 && sess.current_node_key === 'node-10') {
            console.log('✅ TEST PASSED: Product node triggered exactly ONCE and progressed cleanly to node-10!');
        } else {
            console.error(`❌ TEST FAILED: Product node count = ${productExecs.length}, current_node_key = ${sess?.current_node_key}`);
        }

        // Clean up test data
        await pool.query('DELETE FROM chatbot_sessions WHERE phone = ?', [testPhone]);
        process.exit(0);
    } catch (err) {
        console.error('Simulation error:', err);
        process.exit(1);
    }
}

testSimulation();

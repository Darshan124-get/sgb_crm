const pool = require('./src/config/db');
const TelephonyService = require('./src/services/telephony.service');

async function syncProductionDids() {
    console.log('🚀 Attempting Live Acefone DID Sync (No sample/mock data)...');
    try {
        const dids = await TelephonyService.syncDidsFromAcefone();
        console.log(`✅ Live Acefone Sync Complete: ${dids.length} DIDs imported directly from Acefone portal.`);
    } catch (err) {
        console.warn('⚠️ Live Acefone DID Sync skipped/failed:', err.message);
        console.log('ℹ️ Production DID table remains clean until live Acefone token with My Number scope is configured.');
    }
    process.exit();
}

syncProductionDids().catch(err => {
    console.error(err);
    process.exit(1);
});



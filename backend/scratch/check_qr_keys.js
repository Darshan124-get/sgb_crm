const fs = require('fs');
const ledger = JSON.parse(fs.readFileSync('scratch/migration_ledger.json', 'utf8'));

const qrKeys = Object.keys(ledger.items).filter(k => k.includes('quick-replies'));
console.log(`Found ${qrKeys.length} quick reply keys in ledger:`);
qrKeys.slice(0, 10).forEach(k => console.log(' -', ledger.items[k].target_key));

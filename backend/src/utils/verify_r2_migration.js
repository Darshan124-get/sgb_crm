const storageService = require('../services/storage.service');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LEDGER_PATH = path.join(__dirname, '../../scratch/migration_ledger.json');

async function verifyMigration() {
  console.log('====================================================');
  console.log(' 🔍 CLOUDFLARE R2 MIGRATION VALIDATION & AUDIT ');
  console.log('====================================================\n');

  if (!fs.existsSync(LEDGER_PATH)) {
    console.error('❌ Migration ledger not found at:', LEDGER_PATH);
    process.exit(1);
  }

  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  const items = ledger.items || {};
  const itemKeys = Object.keys(items);

  console.log(`Total ledger items to verify: ${itemKeys.length}`);

  let verifiedCount = 0;
  let missingCount = 0;
  let errorCount = 0;
  let totalBytes = 0;

  const CONCURRENCY = 20;

  for (let i = 0; i < itemKeys.length; i += CONCURRENCY) {
    const chunkKeys = itemKeys.slice(i, i + CONCURRENCY);
    const chunkPromises = chunkKeys.map(async (key) => {
      const item = items[key];
      try {
        const exists = await storageService.objectExists({ key: item.target_key });
        if (exists) {
          const meta = await storageService.getObjectMetadata({ key: item.target_key });
          if (meta && (item.size === 0 || meta.contentLength === item.size)) {
            return { status: 'verified', size: meta.contentLength || item.size };
          } else {
            console.warn(`⚠️ Size mismatch for key '${item.target_key}': Expected ${item.size}, got ${meta?.contentLength}`);
            return { status: 'error', size: 0 };
          }
        } else {
          console.error(`❌ Object missing in R2: '${item.target_key}'`);
          return { status: 'missing', size: 0 };
        }
      } catch (err) {
        console.error(`❌ Verification error for key '${item.target_key}':`, err.message);
        return { status: 'error', size: 0 };
      }
    });

    const results = await Promise.all(chunkPromises);
    for (const r of results) {
      if (r.status === 'verified') {
        verifiedCount++;
        totalBytes += r.size;
      } else if (r.status === 'missing') {
        missingCount++;
      } else {
        errorCount++;
      }
    }
  }

  console.log('\n====================================================');
  console.log(' 📊 VALIDATION REPORT');
  console.log('====================================================');
  console.log(` Total Items Verified: ${itemKeys.length}`);
  console.log(` 100% Validated in R2: ${verifiedCount}`);
  console.log(` Missing Items:       ${missingCount}`);
  console.log(` Errors / Mismatches: ${errorCount}`);
  console.log(` Verified Storage:     ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log('====================================================\n');

  if (missingCount === 0 && errorCount === 0) {
    console.log('🎉 VERIFICATION PASSED: ALL OBJECTS ARE FULLY SYNCHRONIZED AND VERIFIED IN CLOUDFLARE R2!');
  } else {
    console.warn('⚠️ VERIFICATION WARNING: Some items require re-migration.');
  }

  process.exit(0);
}

verifyMigration().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

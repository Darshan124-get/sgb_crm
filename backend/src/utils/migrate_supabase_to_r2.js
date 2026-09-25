const supabase = require('../config/supabase');
const storageService = require('../services/storage.service');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LEDGER_PATH = path.join(__dirname, '../../scratch/migration_ledger.json');

const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes('--dry-run');
const IS_VERIFY_ONLY = args.includes('--verify-only');
const CONCURRENCY = 10; // 10 parallel copy workers

function loadLedger() {
  if (fs.existsSync(LEDGER_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Ledger corrupt, initializing fresh ledger.');
    }
  }
  return {
    started_at: new Date().toISOString(),
    completed_at: null,
    items: {},
    summary: { total: 0, migrated: 0, skipped: 0, failed: 0, verified: 0, total_bytes: 0 }
  };
}

function saveLedger(ledger) {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

/**
 * Fast parallel recursive folder listing.
 */
async function listSupabaseFiles(bucket, folder = '') {
  let filesList = [];
  let offset = 0;
  const limit = 1000;

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data || data.length === 0) {
    if (error) console.error(`❌ Error listing '${folder}' in bucket '${bucket}':`, error.message);
    return filesList;
  }

  const subfolderPromises = [];
  for (const item of data) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    const isFolder = !item.id && (!item.metadata || Object.keys(item.metadata).length === 0);

    if (isFolder) {
      subfolderPromises.push(listSupabaseFiles(bucket, itemPath));
    } else {
      filesList.push({
        bucket,
        path: itemPath,
        size: item.metadata?.size || item.size || 0,
        mimetype: item.metadata?.mimetype || 'application/octet-stream'
      });
    }
  }

  if (subfolderPromises.length > 0) {
    const subfolderResults = await Promise.all(subfolderPromises);
    for (const subFiles of subfolderResults) {
      filesList = filesList.concat(subFiles);
    }
  }

  return filesList;
}

async function processSingleFile(file, ledger) {
  const targetKey = file.path;
  const ledgerKey = `SGB:${file.path}`;

  if (IS_DRY_RUN) {
    return { status: 'skipped', bytes: file.size };
  }

  // 1. Check if already present in Cloudflare R2
  try {
    const existingMeta = await storageService.getObjectMetadata({ key: targetKey });
    if (existingMeta && (file.size === 0 || existingMeta.contentLength === file.size)) {
      ledger.items[ledgerKey] = {
        source_bucket: 'SGB',
        source_path: file.path,
        target_key: targetKey,
        size: existingMeta.contentLength || file.size,
        mimetype: file.mimetype,
        status: 'verified',
        migrated_at: ledger.items[ledgerKey]?.migrated_at || new Date().toISOString()
      };
      return { status: 'skipped', verified: true, bytes: existingMeta.contentLength || file.size };
    }
  } catch (e) {
    // Not found in R2
  }

  if (IS_VERIFY_ONLY) {
    ledger.items[ledgerKey] = {
      source_bucket: 'SGB',
      source_path: file.path,
      target_key: targetKey,
      size: file.size,
      status: 'missing_in_r2'
    };
    return { status: 'failed', bytes: 0 };
  }

  // 2. Download from Supabase & Upload to Cloudflare R2
  try {
    const { data: fileBlob, error: dlError } = await supabase.storage
      .from('SGB')
      .download(file.path);

    if (dlError || !fileBlob) {
      throw new Error(dlError?.message || 'Download failed');
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    const uploadRes = await storageService.uploadObject({
      key: targetKey,
      body: buffer,
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        original_bucket: 'SGB',
        original_path: file.path
      }
    });

    ledger.items[ledgerKey] = {
      source_bucket: 'SGB',
      source_path: file.path,
      target_key: targetKey,
      target_url: uploadRes.url,
      size: buffer.length,
      mimetype: file.mimetype,
      status: 'migrated',
      migrated_at: new Date().toISOString()
    };

    return { status: 'migrated', verified: true, bytes: buffer.length };
  } catch (err) {
    console.error(`   ❌ Failed to migrate '${file.path}':`, err.message);
    ledger.items[ledgerKey] = {
      source_bucket: 'SGB',
      source_path: file.path,
      target_key: targetKey,
      error: err.message,
      status: 'failed',
      failed_at: new Date().toISOString()
    };
    return { status: 'failed', bytes: 0 };
  }
}

async function runMigration() {
  console.log('====================================================');
  console.log(' 🚀 SUPABASE STORAGE TO CLOUDFLARE R2 MIGRATION ');
  console.log('====================================================');
  console.log(` Mode: ${IS_DRY_RUN ? 'DRY-RUN (Simulate Only)' : IS_VERIFY_ONLY ? 'VERIFY-ONLY' : 'COPY & MIGRATE'}`);
  console.log(` Concurrency: ${CONCURRENCY} parallel workers`);
  console.log(` Ledger file: ${LEDGER_PATH}\n`);

  const ledger = loadLedger();
  const rootFolders = ['campaigns', 'chatbot-media', 'chats', 'quick-replies'];
  let allFiles = [];

  console.log('🔍 Performing parallel scan of Supabase folders...');
  const folderResults = await Promise.all(
    rootFolders.map(folder => listSupabaseFiles('SGB', folder))
  );

  for (let idx = 0; idx < rootFolders.length; idx++) {
    const fName = rootFolders[idx];
    const fFiles = folderResults[idx];
    console.log(`   Found ${fFiles.length} object(s) under '${fName}'.`);
    allFiles = allFiles.concat(fFiles);
  }

  const rootFiles = (await supabase.storage.from('SGB').list('', { limit: 100 })).data || [];
  for (const item of rootFiles) {
    if (item.id) {
      allFiles.push({
        bucket: 'SGB',
        path: item.name,
        size: item.metadata?.size || item.size || 0,
        mimetype: item.metadata?.mimetype || 'application/octet-stream'
      });
    }
  }

  const totalObjects = allFiles.length;
  console.log(`\n📦 Total Supabase Objects Identified: ${totalObjects}\n`);

  let countMigrated = 0;
  let countSkipped = 0;
  let countFailed = 0;
  let countVerified = 0;
  let totalBytesProcessed = 0;

  for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
    const chunk = allFiles.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((file) => processSingleFile(file, ledger))
    );

    for (const res of chunkResults) {
      if (res.status === 'migrated') countMigrated++;
      if (res.status === 'skipped') countSkipped++;
      if (res.status === 'failed') countFailed++;
      if (res.verified) countVerified++;
      totalBytesProcessed += res.bytes;
    }

    const processedSoFar = Math.min(i + CONCURRENCY, totalObjects);
    const percent = Math.round((processedSoFar / totalObjects) * 100);
    console.log(`[Progress ${processedSoFar}/${totalObjects}] (${percent}%) Migrated: ${countMigrated}, Skipped: ${countSkipped}, Failed: ${countFailed}`);

    saveLedger(ledger);
  }

  ledger.summary = {
    total: totalObjects,
    migrated: countMigrated,
    skipped: countSkipped,
    verified: countVerified,
    failed: countFailed,
    total_bytes: totalBytesProcessed,
    completed_at: new Date().toISOString()
  };

  saveLedger(ledger);

  console.log('\n====================================================');
  console.log(' 🎉 MIGRATION SUMMARY');
  console.log('====================================================');
  console.log(` Total Objects: ${totalObjects}`);
  console.log(` Newly Migrated: ${countMigrated}`);
  console.log(` Skipped/Exist: ${countSkipped}`);
  console.log(` Verified OK:   ${countVerified}`);
  console.log(` Failed:        ${countFailed}`);
  console.log(` Total Bytes:   ${(totalBytesProcessed / (1024 * 1024)).toFixed(2)} MB`);
  console.log('====================================================\n');
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});

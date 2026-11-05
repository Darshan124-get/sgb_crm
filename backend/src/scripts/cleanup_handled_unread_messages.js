const db = require('../config/db');

async function runCleanup(isDryRun = false) {
  console.log(`[CLEANUP] Starting safe unread messages cleanup (Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'})...`);

  // 1. Current state before cleanup
  const [[{ total_unread: totalUnreadBefore }]] = await db.query(
    "SELECT COUNT(*) AS total_unread FROM chat_messages WHERE sender_type = 'user' AND status = 'sent'"
  );
  const [[{ total_sessions: totalSessionsBefore }]] = await db.query(
    "SELECT COUNT(DISTINCT session_id) AS total_sessions FROM chat_messages WHERE sender_type = 'user' AND status = 'sent'"
  );

  console.log(`[CLEANUP] Before cleanup: ${totalUnreadBefore} unread messages across ${totalSessionsBefore} sessions.`);

  // 2. Identify candidate messages to mark as read:
  // - Customer messages ('user') currently marked 'sent'
  // - Lead is NOT 'human_needed'
  // - Chatbot session is NOT 'paused_for_human'
  // - A subsequent admin/bot message exists in the same session (cm_admin.chat_id > cm.chat_id)
  const candidateQuery = `
    SELECT cm.chat_id
    FROM chat_messages cm
    JOIN chat_sessions cs ON cm.session_id = cs.session_id
    JOIN leads l ON cs.lead_id = l.lead_id
    WHERE cm.sender_type = 'user' AND cm.status = 'sent'
      AND l.status != 'human_needed'
      AND NOT EXISTS (
        SELECT 1 FROM chatbot_sessions cbs 
        WHERE (cbs.phone COLLATE utf8mb4_unicode_ci = l.phone_number COLLATE utf8mb4_unicode_ci 
               OR cbs.phone COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', RIGHT(l.phone_number, 10)))
          AND cbs.status = 'paused_for_human'
      )
      AND EXISTS (
        SELECT 1 FROM chat_messages cm_admin
        WHERE cm_admin.session_id = cm.session_id
          AND cm_admin.sender_type = 'admin'
          AND cm_admin.chat_id > cm.chat_id
      )
  `;

  const [candidates] = await db.query(candidateQuery);
  console.log(`[CLEANUP] Found ${candidates.length} candidate messages that were successfully answered by bot/admin.`);

  if (candidates.length === 0) {
    console.log('[CLEANUP] No messages need cleanup.');
    return;
  }

  if (isDryRun) {
    console.log('[CLEANUP] DRY RUN complete. No changes written to database.');
    return;
  }

  // 3. Perform batch update in chunks to ensure zero lock contention
  const candidateIds = candidates.map(c => c.chat_id);
  const chunkSize = 500;
  let updatedCount = 0;

  for (let i = 0; i < candidateIds.length; i += chunkSize) {
    const chunk = candidateIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const [result] = await db.query(
      `UPDATE chat_messages SET status = 'read' WHERE chat_id IN (${placeholders})`,
      chunk
    );
    updatedCount += result.affectedRows;
    console.log(`[CLEANUP] Processed batch ${Math.floor(i / chunkSize) + 1} (${updatedCount}/${candidateIds.length} updated)`);
  }

  // 4. Verify state after cleanup
  const [[{ total_unread: totalUnreadAfter }]] = await db.query(
    "SELECT COUNT(*) AS total_unread FROM chat_messages WHERE sender_type = 'user' AND status = 'sent'"
  );
  const [[{ total_sessions: totalSessionsAfter }]] = await db.query(
    "SELECT COUNT(DISTINCT session_id) AS total_sessions FROM chat_messages WHERE sender_type = 'user' AND status = 'sent'"
  );

  console.log(`[CLEANUP] Successfully updated ${updatedCount} messages to 'read'.`);
  console.log(`[CLEANUP] After cleanup: ${totalUnreadAfter} unread messages across ${totalSessionsAfter} sessions.`);
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  runCleanup(isDryRun)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[CLEANUP ERROR]:', err);
      process.exit(1);
    });
}

module.exports = { runCleanup };

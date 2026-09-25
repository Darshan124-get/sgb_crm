const db = require('../src/config/db');

async function testFastSearch(searchTerm) {
  console.time('Fast Search Execution');
  const trimmedSearch = searchTerm.trim().toLowerCase();
  const searchDigits = trimmedSearch.replace(/\D/g, '');
  const searchPattern = `%${trimmedSearch}%`;

  // Step 1: Find matching lead_ids first (indexed search, extremely fast!)
  let leadQuery = `SELECT lead_id FROM leads WHERE 1=1`;
  let leadParams = [];
  if (searchDigits && searchDigits.length >= 3) {
    const digitsPattern = `%${searchDigits}%`;
    leadQuery += " AND (LOWER(customer_name) LIKE ? OR phone_number LIKE ? OR REPLACE(REPLACE(phone_number, '+', ''), ' ', '') LIKE ?)";
    leadParams.push(searchPattern, searchPattern, digitsPattern);
  } else {
    leadQuery += " AND (LOWER(customer_name) LIKE ? OR phone_number LIKE ?)";
    leadParams.push(searchPattern, searchPattern);
  }
  leadQuery += " LIMIT 100";

  const [matchingLeads] = await db.execute(leadQuery, leadParams);
  const leadIds = matchingLeads.map(l => l.lead_id);

  if (leadIds.length === 0) {
    console.timeEnd('Fast Search Execution');
    console.log('No leads matched. Speed: FAST');
    return [];
  }

  // Step 2: Query full details ONLY for matching lead_ids!
  const inClause = leadIds.map(() => '?').join(',');
  let query = `
    SELECT 
      l.*, 
      l.phone_number AS phone, 
      u.name AS assigned_name,
      cs_paused.status AS session_status,
      cs_paused.paused_at AS paused_at,
      agg.last_message_at,
      agg.last_inbound_at,
      COALESCE(agg.unread_msg_count, 0) AS unread_msg_count,
      cm_last.message AS last_message,
      cm_last.sender_type AS last_message_sender_type,
      cm_last.status AS last_message_status
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.user_id
    LEFT JOIN (
      SELECT 
        cs.lead_id,
        MAX(cm.chat_id) AS max_chat_id,
        MAX(cm.timestamp) AS last_message_at,
        MAX(CASE WHEN cm.sender_type = 'user' THEN cm.timestamp ELSE NULL END) AS last_inbound_at,
        SUM(CASE WHEN cm.sender_type = 'user' AND cm.status = 'sent' THEN 1 ELSE 0 END) AS unread_msg_count
      FROM chat_sessions cs
      JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE cs.lead_id IN (${inClause})
      GROUP BY cs.lead_id
    ) agg ON l.lead_id = agg.lead_id
    LEFT JOIN chat_messages cm_last ON cm_last.chat_id = agg.max_chat_id
    LEFT JOIN (
      SELECT cs1.lead_id, cs1.phone, cs1.status, cs1.paused_at
      FROM chatbot_sessions cs1
      JOIN (
        SELECT MAX(session_id) as max_session_id
        FROM chatbot_sessions
        WHERE status = 'paused_for_human' AND lead_id IN (${inClause})
        GROUP BY session_id
      ) cs2 ON cs1.session_id = cs2.max_session_id
    ) cs_paused ON (cs_paused.lead_id IS NOT NULL AND l.lead_id = cs_paused.lead_id)
    WHERE l.lead_id IN (${inClause})
    ORDER BY agg.last_message_at DESC, l.created_at DESC
  `;

  const [rows] = await db.execute(query, [...leadIds, ...leadIds, ...leadIds]);
  console.timeEnd('Fast Search Execution');
  console.log(`Found ${rows.length} rows for search "${searchTerm}"`);
  return rows;
}

testFastSearch('7999').then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

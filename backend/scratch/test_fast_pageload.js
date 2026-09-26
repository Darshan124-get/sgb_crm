const db = require('../src/config/db');

async function testFastPageLoad(user, options = {}) {
  console.time('Fast Page Load');
  const limit = parseInt(options.limit) > 0 ? parseInt(options.limit) : 30;
  const page = parseInt(options.page) > 0 ? parseInt(options.page) : 1;
  const offset = (page - 1) * limit;

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
      GROUP BY cs.lead_id
    ) agg ON l.lead_id = agg.lead_id
    LEFT JOIN chat_messages cm_last ON cm_last.chat_id = agg.max_chat_id
    LEFT JOIN (
      SELECT cs1.lead_id, cs1.phone, cs1.status, cs1.paused_at
      FROM chatbot_sessions cs1
      JOIN (
        SELECT MAX(session_id) as max_session_id
        FROM chatbot_sessions
        WHERE status = 'paused_for_human'
        GROUP BY COALESCE(lead_id, phone)
      ) cs2 ON cs1.session_id = cs2.max_session_id
    ) cs_paused ON (cs_paused.lead_id IS NOT NULL AND l.lead_id = cs_paused.lead_id)
       OR (RIGHT(REPLACE(l.phone_number, '+', ''), 10) COLLATE utf8mb4_general_ci = RIGHT(REPLACE(cs_paused.phone, '+', ''), 10) COLLATE utf8mb4_general_ci AND LENGTH(REPLACE(cs_paused.phone, '+', '')) >= 10)
    WHERE 1=1
  `;
  let params = [];

  if (options.tab === 'handoff' || options.tab === 'my_handoff') {
    query += " AND (l.status = 'human_needed' OR cs_paused.status = 'paused_for_human')";
    if (options.tab === 'my_handoff' && user && user.id) {
      query += " AND l.assigned_to = ?";
      params.push(user.id);
    }
  } else if (options.tab === 'unviewed') {
    query += " AND COALESCE(agg.unread_msg_count, 0) > 0";
  } else if (options.tab === 'resolved') {
    query += " AND l.status IN ('converted', 'closed', 'lost')";
  }

  query += ` ORDER BY agg.last_message_at DESC, l.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const countPromise = db.execute(`SELECT COUNT(*) AS total FROM leads l`);
  const unreadPromise = db.execute(`SELECT COUNT(DISTINCT session_id) AS total_unread FROM chat_messages WHERE sender_type = 'user' AND status = 'sent'`);
  const handoffPromise = db.execute(`SELECT COUNT(DISTINCT COALESCE(cs1.lead_id, cs1.phone)) AS total_handoff FROM chatbot_sessions cs1 WHERE cs1.status = 'paused_for_human'`);

  const [[rows], [countRows], [unreadRows], [handoffRows]] = await Promise.all([
    db.execute(query, params),
    countPromise,
    unreadPromise,
    handoffPromise
  ]);

  console.timeEnd('Fast Page Load');
  return {
    customers: rows,
    totalCount: countRows[0] ? countRows[0].total : rows.length,
    unreadCount: unreadRows[0] ? unreadRows[0].total_unread : 0,
    handoffCount: handoffRows[0] ? handoffRows[0].total_handoff : 0
  };
}

module.exports = testFastPageLoad;





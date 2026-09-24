const db = require('../config/db');
const logger = require('../utils/whatsappLogger');
const { normalizePhone } = require('../utils/phoneUtils');
const supabase = require('../config/supabase');

/**
 * Helper to ensure no parameters are 'undefined' (MySQL driver requirement)
 */
const mapParams = (params) => params.map(p => p === undefined ? null : p);

/**
 * Helper to safely parse JSON data from MySQL
 */
const parseData = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (err) {
    logger.error('JSON parsing error:', err.message);
    return {};
  }
};

/**
 * Stores incoming message into MySQL (Lead Generation)
 */
const storeMessageAsLead = async (phone, message) => {
  const phone_number = normalizePhone(phone);
  try {
    const query = `
      INSERT INTO leads (phone_number, first_message, source) 
      VALUES (?, ?, 'whatsapp') 
      ON DUPLICATE KEY UPDATE 
      updated_at = CURRENT_TIMESTAMP
    `;
    const [result] = await db.execute(query, mapParams([phone_number, message]));
    return result;
  } catch (err) {
    logger.error('Database error in storeMessageAsLead:', err.message);
    throw err;
  }
};

/**
 * Gets the current bot flow session for a phone number
 */
const getSession = async (phoneInput) => {
  const phone = normalizePhone(phoneInput);
  try {
    const [rows] = await db.execute('SELECT * FROM bot_sessions WHERE phone = ?', [phone]);
    if (rows.length > 0) {
      const session = rows[0];
      session.data = parseData(session.data);
      return session;
    }
    return null;
  } catch (err) {
    logger.error('Session fetch error:', err.message);
    throw err;
  }
};

/**
 * Updates or creates a bot flow session
 */
const updateSession = async (phoneInput, state, data = {}) => {
  const phone = normalizePhone(phoneInput);
  try {
    const jsonData = JSON.stringify(data);
    const query = `
      INSERT INTO bot_sessions (phone, current_state, data) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
      current_state = VALUES(current_state), 
      data = VALUES(data), 
      updated_at = CURRENT_TIMESTAMP
    `;
    await db.execute(query, mapParams([phone, state, jsonData]));
  } catch (err) {
    logger.error('Session update error:', err.message);
    throw err;
  }
};

/**
 * Gets lead details from CRM
 */
const getCustomer = async (phoneInput) => {
  const phone = normalizePhone(phoneInput);
  try {
    const [rows] = await db.execute('SELECT * FROM leads WHERE phone_number = ?', [phone]);
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    logger.error('Lead fetch error:', err.message);
    throw err;
  }
};

/**
 * Updates lead profile in CRM
 */
const upsertCustomer = async (phoneInput, name, city, language) => {
  const phone = normalizePhone(phoneInput);
  try {
    const query = `
      UPDATE leads 
      SET customer_name = ?, city = ?, language = ? 
      WHERE phone_number = ?
    `;
    await db.execute(query, mapParams([name, city, language, phone]));
  } catch (err) {
    logger.error('Lead update error:', err.message);
    throw err;
  }
};

/**
 * Logs a customer interaction as a lead note
 */
const logInteraction = async (phoneInput, action, data = {}) => {
  const phone = normalizePhone(phoneInput);
  try {
    const [leads] = await db.execute('SELECT lead_id FROM leads WHERE phone_number = ?', [phone]);
    if (leads.length === 0) return;

    const lead_id = leads[0].lead_id;
    const jsonData = JSON.stringify(data);
    await db.execute(
      'INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)',
      [lead_id, `Action: ${action} | Data: ${jsonData}`]
    );
  } catch (err) {
    logger.error('Interaction logging error:', err.message);
  }
};

/**
 * Logs a message to the chat history (linked to CRM chat_sessions)
 */
const logChatMessage = async (phoneInput, direction, messageType, body, mediaData = null, mimeType = null, senderId = null, messageId = null, status = 'sent', replyToChatId = null, isForwarded = 0, quickReplyName = null) => {
  const phone = normalizePhone(phoneInput);
  const phoneTen = String(phoneInput).replace(/\D/g, '').slice(-10);
  try {
    // 1. Get Lead ID and assignment details (with flexible phone number matching)
    let [leads] = await db.execute(
      'SELECT lead_id, assigned_to, customer_name FROM leads WHERE phone_number = ? OR phone_number = ? OR phone_number LIKE ? LIMIT 1',
      [phone, phoneInput, `%${phoneTen}`]
    );

    let lead_id;
    let assigned_to = null;
    let customer_name = null;

    if (leads.length === 0) {
      // Auto-create lead entry if missing to ensure bot messages are never dropped
      await storeMessageAsLead(phoneInput, body || 'Incoming message');
      const [newLeads] = await db.execute(
        'SELECT lead_id, assigned_to, customer_name FROM leads WHERE phone_number = ? OR phone_number = ? OR phone_number LIKE ? LIMIT 1',
        [phone, phoneInput, `%${phoneTen}`]
      );
      if (newLeads.length === 0) return;
      lead_id = newLeads[0].lead_id;
      assigned_to = newLeads[0].assigned_to;
      customer_name = newLeads[0].customer_name;
    } else {
      lead_id = leads[0].lead_id;
      assigned_to = leads[0].assigned_to;
      customer_name = leads[0].customer_name;
    }

    // 2. Get or Create an Open Chat Session
    let [sessions] = await db.execute('SELECT session_id FROM chat_sessions WHERE lead_id = ? AND status = "open"', [lead_id]);
    let session_id;
    if (sessions.length === 0) {
      const [result] = await db.execute('INSERT INTO chat_sessions (lead_id, status) VALUES (?, "open")', [lead_id]);
      session_id = result.insertId;
    } else {
      session_id = sessions[0].session_id;
    }

    // 3. Log Message
    const sender_type = (direction === 'incoming') ? 'user' : 'admin';

    let mediaUrl = null;
    let buffer = null;

    if (mediaData) {
      if (typeof mediaData === 'string' && mediaData.startsWith('http')) {
        mediaUrl = mediaData;
      } else if (typeof mediaData === 'string' && mediaData.includes(',')) {
        buffer = Buffer.from(mediaData.split(',')[1], 'base64');
      } else if (typeof mediaData === 'string') {
        buffer = Buffer.from(mediaData, 'base64');
      } else if (Buffer.isBuffer(mediaData)) {
        buffer = mediaData;
      }

      if (buffer && Buffer.isBuffer(buffer)) {
        const timestamp = Date.now();
        const cleanMime = (mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
        const mimeMap = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'video/3gpp': '3gp',
          'audio/aac': 'aac',
          'audio/mp4': 'm4a',
          'audio/amr': 'amr',
          'audio/mpeg': 'mp3',
          'audio/ogg': 'ogg',
          'application/pdf': 'pdf'
        };
        let extension = mimeMap[cleanMime] || (cleanMime.split('/')[1] || 'bin').replace(/[^a-zA-Z0-9]/g, '');
        if (extension === 'jpeg') extension = 'jpg';
        const fileName = `${timestamp}-${phone}.${extension}`;
        const filePath = `chats/${phone}/${fileName}`;

        const { data, error } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
          .upload(filePath, buffer, {
            contentType: cleanMime,
            upsert: true
          });

        if (error) {
          logger.error('Supabase upload error:', error.message);
        } else {
          // Get Public URL
          const { data: urlData } = supabase.storage
            .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
            .getPublicUrl(filePath);

          mediaUrl = urlData.publicUrl;
          logger.info(`[SUPABASE] File uploaded: ${mediaUrl}`);
        }
      }
    }

    await db.execute(
      'INSERT INTO chat_messages (session_id, sender_type, sender_id, message_type, message, media_data, media_url, mime_type, message_id, status, reply_to_chat_id, is_forwarded, quick_reply_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      mapParams([session_id, sender_type, senderId, messageType, body, (mediaUrl ? null : buffer), mediaUrl, mimeType, messageId, status, replyToChatId, isForwarded, quickReplyName])
    );

    // 4. Send push notification to assigned executive if message is incoming
    if (direction === 'incoming' && assigned_to) {
      try {
        const notificationService = require('./notification.service');
        const leadName = customer_name || phoneInput;
        const snippet = messageType === 'text' ? body : `Sent a ${messageType}`;
        await notificationService.sendToUser(
          assigned_to,
          `New Message from ${leadName}`,
          snippet,
          { leadId: String(lead_id), type: 'whatsapp_message' }
        );
      } catch (notifErr) {
        logger.error('FCM Notification error (logChatMessage):', notifErr.message);
      }
    }
  } catch (err) {
    logger.error('Chat logging error:', err);
    throw err; // Re-throw so controller catches it
  }
};

/**
 * Gets chat history for a specific phone number
 */
const getChatHistory = async (phoneInput, user = null) => {
  const phone = normalizePhone(phoneInput);
  const phoneTen = String(phoneInput).replace(/\D/g, '').slice(-10);
  try {
    let baseQuery = `
      SELECT cm.*, 
      CASE WHEN cm.sender_type = 'user' THEN 'incoming' ELSE 'outgoing' END as direction, 
      cm.message as body,
      COALESCE(u.name, CASE WHEN cm.sender_type = 'admin' AND cm.sender_id = -2 THEN 'Campaign' WHEN cm.sender_type = 'admin' AND (cm.sender_id IS NULL OR cm.sender_id = -1) THEN 'Chatbot' ELSE NULL END) as sender_name
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.session_id
      JOIN leads l ON cs.lead_id = l.lead_id
      LEFT JOIN users u ON cm.sender_id = u.user_id
      WHERE (l.phone_number = ? OR l.phone_number = ? OR l.phone_number LIKE ? OR RIGHT(REPLACE(l.phone_number, '+', ''), 10) = ?)
    `;
    let params = [phone, phoneInput, `%${phoneTen}`, phoneTen];

    if (user && (user.role.toLowerCase().includes('executive') || user.role.toLowerCase() === 'viewer' || user.role.toLowerCase() === 'sales') && !user.role.toLowerCase().includes('whatsapp')) {
      baseQuery += " AND l.assigned_to = ?";
      params.push(user.id);
    }

    baseQuery += " ORDER BY cm.timestamp DESC, cm.chat_id DESC LIMIT 300";

    const fullQuery = `
      SELECT * FROM (${baseQuery}) sub
      ORDER BY sub.timestamp ASC, sub.chat_id ASC
    `;

    const [rows] = await db.execute(fullQuery, params);
    return rows;
  } catch (err) {
    logger.error('Fetch chat history error:', err.message);
    throw err;
  }
};

/**
 * Gets a list of all leads who have chats
 */
const getAllChatCustomers = async (user = null, options = {}) => {
  try {
    const limit = parseInt(options.limit) > 0 ? parseInt(options.limit) : 30;
    const page = parseInt(options.page) > 0 ? parseInt(options.page) : 1;
    const offset = (page - 1) * limit;

    if (options.search) {
      const trimmedSearch = options.search.trim().toLowerCase();
      const searchDigits = trimmedSearch.replace(/\D/g, '');
      const searchPattern = `%${trimmedSearch}%`;

      let leadQuery = `SELECT l.lead_id FROM leads l WHERE 1=1`;
      let leadParams = [];

      if (user && (user.role.toLowerCase().includes('executive') || user.role.toLowerCase() === 'viewer' || user.role.toLowerCase() === 'sales') && !user.role.toLowerCase().includes('whatsapp')) {
        leadQuery += " AND l.assigned_to = ?";
        leadParams.push(user.id);
      }

      if (searchDigits && searchDigits.length >= 3) {
        const digitsPattern = `%${searchDigits}%`;
        leadQuery += " AND (LOWER(l.customer_name) LIKE ? OR l.phone_number LIKE ? OR REPLACE(REPLACE(l.phone_number, '+', ''), ' ', '') LIKE ?)";
        leadParams.push(searchPattern, searchPattern, digitsPattern);
      } else {
        leadQuery += " AND (LOWER(l.customer_name) LIKE ? OR l.phone_number LIKE ?)";
        leadParams.push(searchPattern, searchPattern);
      }

      leadQuery += " LIMIT 100";

      const [matchingLeads] = await db.execute(leadQuery, leadParams);
      const leadIds = matchingLeads.map(l => l.lead_id);

      if (leadIds.length === 0) {
        return { customers: [], totalCount: 0, unreadCount: 0, handoffCount: 0 };
      }

      const inClause = leadIds.map(() => '?').join(',');
      let searchQuery = `
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

      const [rows] = await db.execute(searchQuery, [...leadIds, ...leadIds, ...leadIds]);
      return { customers: rows, totalCount: rows.length, unreadCount: 0, handoffCount: 0 };
    }

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
        SELECT lead_id, status, paused_at
        FROM chatbot_sessions
        WHERE status = 'paused_for_human'
        ORDER BY session_id DESC
        LIMIT 100
      ) cs_paused ON l.lead_id = cs_paused.lead_id
      WHERE 1=1
    `;
    let params = [];

    if (user && (user.role.toLowerCase().includes('executive') || user.role.toLowerCase() === 'viewer' || user.role.toLowerCase() === 'sales') && !user.role.toLowerCase().includes('whatsapp')) {
      query += " AND l.assigned_to = ?";
      params.push(user.id);
    }

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

    // Compute total count of leads matching user filter
    let countQuery = `SELECT COUNT(*) AS total FROM leads l WHERE 1=1`;
    let countParams = [];
    if (user && (user.role.toLowerCase().includes('executive') || user.role.toLowerCase() === 'viewer' || user.role.toLowerCase() === 'sales') && !user.role.toLowerCase().includes('whatsapp')) {
      countQuery += " AND l.assigned_to = ?";
      countParams.push(user.id);
    }

    // Compute total unread count across DB
    let unreadQuery = `
      SELECT COUNT(DISTINCT session_id) AS total_unread 
      FROM chat_messages 
      WHERE sender_type = 'user' AND status = 'sent'
    `;
    let unreadParams = [];

    // Compute total handoff count across DB
    let handoffQuery = `
      SELECT COUNT(*) AS total_handoff 
      FROM chatbot_sessions 
      WHERE status = 'paused_for_human'
    `;
    let handoffParams = [];

    const [[rows], [countRows], [unreadRows], [handoffRows]] = await Promise.all([
      db.execute(query, params),
      db.execute(countQuery, countParams),
      db.execute(unreadQuery, unreadParams),
      db.execute(handoffQuery, handoffParams)
    ]);

    const totalCount = countRows[0] ? parseInt(countRows[0].total) : rows.length;
    const unreadCount = unreadRows[0] ? parseInt(unreadRows[0].total_unread) : 0;
    const handoffCount = handoffRows[0] ? parseInt(handoffRows[0].total_handoff) : 0;

    return {
      customers: rows,
      totalCount: totalCount,
      unreadCount: unreadCount,
      handoffCount: handoffCount,
      page: page,
      limit: limit
    };
  } catch (err) {
    logger.error('Fetch all chat customers error:', err.message);
    throw err;
  }
};

const deleteChatMessage = async (chatId) => {
  await db.execute('DELETE FROM chat_messages WHERE chat_id = ?', [chatId]);
};

/**
 * Marks incoming messages as read for a given phone number
 */
const markMessagesAsRead = async (phoneInput) => {
  const phone = normalizePhone(phoneInput);
  try {
    const [leads] = await db.execute('SELECT lead_id FROM leads WHERE phone_number = ?', [phone]);
    if (leads.length === 0) return;
    const lead_id = leads[0].lead_id;

    await db.execute(`
      UPDATE chat_messages 
      SET status = 'read' 
      WHERE sender_type = 'user' 
        AND status = 'sent' 
        AND session_id IN (SELECT session_id FROM chat_sessions WHERE lead_id = ?)
    `, [lead_id]);
  } catch (err) {
    logger.error('Error marking messages as read:', err.message);
  }
};

const markMessagesAsUnread = async (phoneInput) => {
  const phone = normalizePhone(phoneInput);
  try {
    const [leads] = await db.execute('SELECT lead_id FROM leads WHERE phone_number = ?', [phone]);
    if (leads.length === 0) return;
    const lead_id = leads[0].lead_id;

    // Change the status of the last message from the user back to 'sent'
    await db.execute(`
      UPDATE chat_messages 
      SET status = 'sent' 
      WHERE sender_type = 'user' 
        AND session_id IN (SELECT session_id FROM chat_sessions WHERE lead_id = ?)
      ORDER BY chat_id DESC 
      LIMIT 1
    `, [lead_id]);
  } catch (err) {
    logger.error('Error marking messages as unread:', err.message);
  }
};

/**
 * Updates the delivery/read status of an outgoing message
 */
const updateMessageStatus = async (messageId, status) => {
  try {
    // Only update if it's a valid progression (e.g. sent -> delivered -> read)
    // Or just let WhatsApp's webhook order dictate it for simplicity.
    await db.execute('UPDATE chat_messages SET status = ? WHERE message_id = ?', [status, messageId]);
  } catch (err) {
    logger.error('Message status update error:', err.message);
  }
};

module.exports = {
  storeMessageAsLead,
  getSession,
  updateSession,
  getCustomer,
  upsertCustomer,
  logInteraction,
  logChatMessage,
  getChatHistory,
  getAllChatCustomers,
  deleteChatMessage,
  markMessagesAsRead,
  markMessagesAsUnread,
  updateMessageStatus
};

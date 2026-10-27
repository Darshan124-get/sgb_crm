const db = require('../config/db');
const logger = require('../utils/whatsappLogger');
const { normalizePhone } = require('../utils/phoneUtils');

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
      const storageService = require('./storage.service');
      if (typeof mediaData === 'string' && (mediaData.startsWith('http') || mediaData.startsWith('/api/media/') || mediaData.includes('/') || mediaData.includes('.')) && !mediaData.includes(',')) {
        mediaUrl = storageService.getPublicUrl(mediaData);
      } else if (typeof mediaData === 'string' && mediaData.includes(',')) {
        buffer = Buffer.from(mediaData.split(',')[1], 'base64');
      } else if (typeof mediaData === 'string' && mediaData.length > 500) {
        buffer = Buffer.from(mediaData, 'base64');
      } else if (typeof mediaData === 'string') {
        mediaUrl = storageService.getPublicUrl(mediaData);
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
        const filePath = `chats/${fileName}`;
        const storageService = require('./storage.service');
        // 1. Always save locally to uploads/chats with lead phone number in filename
        try {
          const fs = require('fs');
          const path = require('path');
          const localChatDir = path.join(__dirname, '../../uploads/chats');
          if (!fs.existsSync(localChatDir)) {
            fs.mkdirSync(localChatDir, { recursive: true });
          }
          fs.writeFileSync(path.join(localChatDir, fileName), buffer);
          if (!mediaUrl) {
            mediaUrl = storageService.getPublicUrl(filePath);
          }
        } catch (localSaveErr) {
          logger.warn('Local disk save error:', localSaveErr.message);
        }

        // 2. Upload to Cloudflare R2 if available
        try {
          const uploadResult = await storageService.uploadObject({
            key: filePath,
            body: buffer,
            contentType: cleanMime
          });
          mediaUrl = uploadResult.publicUrl;
          logger.info(`[R2 STORAGE] File uploaded: ${mediaUrl}`);
        } catch (uploadErr) {
          logger.error('R2 upload error:', uploadErr.message);
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
      SELECT 
        cm.chat_id, cm.session_id, cm.sender_type, cm.sender_id, cm.message_type, cm.message,
        CASE WHEN cm.media_url IS NOT NULL AND cm.media_url != '' THEN cm.media_url WHEN cm.media_data IS NOT NULL THEN CONCAT('/api/media/message/', cm.chat_id) ELSE NULL END AS media_url,
        NULL AS media_data, cm.timestamp, cm.mime_type, cm.reaction, cm.reply_to_chat_id, cm.is_forwarded, cm.message_id, cm.status, cm.quick_reply_name, 
      CASE WHEN cm.sender_type = 'user' THEN 'incoming' ELSE 'outgoing' END as direction, 
      cm.message as body,
      COALESCE(u.name, CASE WHEN cm.sender_type = 'admin' AND cm.sender_id = -2 THEN 'Campaign' WHEN cm.sender_type = 'admin' AND (cm.sender_id IS NULL OR cm.sender_id = -1) THEN 'Chatbot' ELSE NULL END) as sender_name,
      COALESCE(NULLIF(reply_cm.message, ''), CASE WHEN reply_cm.message_type IS NOT NULL THEN CONCAT('[', UPPER(SUBSTRING(reply_cm.message_type, 1, 1)), LOWER(SUBSTRING(reply_cm.message_type, 2)), ']') ELSE NULL END) as reply_to_text,
      CASE WHEN reply_cm.sender_type = 'user' THEN 'Customer' WHEN reply_cm.sender_type IS NOT NULL THEN 'You' ELSE NULL END as reply_to_sender
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.session_id
      JOIN leads l ON cs.lead_id = l.lead_id
      LEFT JOIN users u ON cm.sender_id = u.user_id
      LEFT JOIN chat_messages reply_cm ON cm.reply_to_chat_id = reply_cm.chat_id
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

const isScopedUser = (u) => {
  if (!u || !u.role || !u.id) return false;
  const role = String(u.role).toLowerCase();
  return (role.includes('executive') || role.includes('telecaller') || role === 'viewer' || role === 'sales') && !role.includes('whatsapp') && !u.is_manager;
};

/**
 * Gets a list of all leads who have chats
 */
const getAllChatCustomers = async (user = null, options = {}) => {
  try {
    const limit = parseInt(options.limit) > 0 ? parseInt(options.limit) : 30;
    const page = parseInt(options.page) > 0 ? parseInt(options.page) : 1;
    const offset = (page - 1) * limit;

    // 1. Fetch active paused chatbot sessions (only 0 to 50 rows)
    const [pausedSessions] = await db.execute(`
      SELECT session_id, lead_id, phone, status, paused_at, current_node_key AS paused_node_key, variables AS paused_session_variables
      FROM chatbot_sessions
      WHERE status = 'paused_for_human'
    `);

    // 2. Fetch pending orders in review (only 0 to 20 rows)
    const [pendingOrders] = await db.execute(`
      SELECT order_id, phone, customer_name, total_amount, order_status
      FROM orders
      WHERE purchase_source = 'whatsapp_chatbot' AND order_status = 'in_review'
    `);

    // Map order session variables if any exist
    let orderVariablesMap = new Map();
    if (pendingOrders.length > 0) {
      const orderPhones = pendingOrders.map(o => o.phone).filter(Boolean);
      if (orderPhones.length > 0) {
        const placeholders = orderPhones.map(() => '?').join(',');
        const [sessions] = await db.execute(`
          SELECT phone, variables 
          FROM chatbot_sessions 
          WHERE phone IN (${placeholders}) 
          ORDER BY session_id DESC
        `, orderPhones);
        sessions.forEach(s => {
          if (!orderVariablesMap.has(s.phone)) {
            orderVariablesMap.set(s.phone, s.variables);
          }
        });
      }
    }

    // Build memory lookup maps for paused sessions
    const pausedMapByLeadId = new Map();
    const pausedMapByPhone10 = new Map();
    const pausedPhone10s = [];

    for (const s of pausedSessions) {
      if (s.lead_id) pausedMapByLeadId.set(s.lead_id, s);
      const digits = (s.phone || '').replace(/\D/g, '');
      if (digits.length >= 10) {
        const p10 = digits.slice(-10);
        pausedMapByPhone10.set(p10, s);
        pausedPhone10s.push(p10);
      }
    }

    // Build memory lookup maps for pending orders
    const orderMapByPhone10 = new Map();
    for (const o of pendingOrders) {
      const digits = (o.phone || '').replace(/\D/g, '');
      if (digits.length >= 10) {
        const p10 = digits.slice(-10);
        orderMapByPhone10.set(p10, {
          ...o,
          session_variables: orderVariablesMap.get(o.phone) || null
        });
      }
    }

    // Match handoff leads (human_needed status OR paused chatbot session)
    const handoffLeadIdSet = new Set();
    let handoffQuery = "SELECT lead_id FROM leads WHERE status = 'human_needed'";
    let handoffQueryParams = [];
    if (isScopedUser(user)) {
      handoffQuery += " AND assigned_to = ?";
      handoffQueryParams.push(user.id);
    }
    const [humanLeads] = await db.execute(handoffQuery, handoffQueryParams);
    humanLeads.forEach(r => handoffLeadIdSet.add(r.lead_id));
    pausedSessions.forEach(p => { if (p.lead_id) handoffLeadIdSet.add(p.lead_id); });

    if (pausedPhone10s.length > 0) {
      const orClauses = pausedPhone10s.map(() => "phone_number LIKE ?").join(" OR ");
      let phoneQuery = `SELECT lead_id FROM leads WHERE (${orClauses})`;
      let phoneParams = pausedPhone10s.map(ph => `%${ph}`);
      if (isScopedUser(user)) {
        phoneQuery += " AND assigned_to = ?";
        phoneParams.push(user.id);
      }
      const [matchedByPhone] = await db.execute(phoneQuery, phoneParams);
      matchedByPhone.forEach(r => handoffLeadIdSet.add(r.lead_id));
    }

    // Match payment leads
    const paymentPhone10s = Array.from(orderMapByPhone10.keys());
    const paymentLeadIdSet = new Set();
    if (paymentPhone10s.length > 0) {
      const orClauses = paymentPhone10s.map(() => "phone_number LIKE ?").join(" OR ");
      let payQuery = `SELECT lead_id FROM leads WHERE (${orClauses})`;
      let payParams = paymentPhone10s.map(ph => `%${ph}`);
      if (isScopedUser(user)) {
        payQuery += " AND assigned_to = ?";
        payParams.push(user.id);
      }
      const [matchedPayLeads] = await db.execute(payQuery, payParams);
      matchedPayLeads.forEach(r => paymentLeadIdSet.add(r.lead_id));
    }

    // Global Counts
    let unreadQuery = '';
    let unreadParams = [];
    if (isScopedUser(user)) {
      unreadQuery = `
        SELECT COUNT(DISTINCT cm.session_id) AS total_unread 
        FROM chat_messages cm
        JOIN chat_sessions cs ON cm.session_id = cs.session_id
        JOIN leads l ON cs.lead_id = l.lead_id
        WHERE cm.sender_type = 'user' AND cm.status = 'sent' AND l.assigned_to = ?
      `;
      unreadParams.push(user.id);
    } else {
      unreadQuery = `
        SELECT COUNT(DISTINCT session_id) AS total_unread 
        FROM chat_messages 
        WHERE sender_type = 'user' AND status = 'sent'
      `;
    }

    const [unreadRows] = await db.execute(unreadQuery, unreadParams);
    const unreadCount = unreadRows[0] ? parseInt(unreadRows[0].total_unread) : 0;
    const handoffCount = handoffLeadIdSet.size;
    const paymentCount = pendingOrders.length;

    // Helper to map DB row to customer response object
    const mapCustomerRow = (r) => {
      const rawPhone = r.phone_number || r.phone || '';
      const phone10 = rawPhone.replace(/\D/g, '').slice(-10);

      const paused = (r.lead_id && pausedMapByLeadId.get(r.lead_id)) || (phone10 && pausedMapByPhone10.get(phone10)) || null;
      const payment = (phone10 && orderMapByPhone10.get(phone10)) || null;

      let paymentScreenshotUrl = null;
      if (payment && payment.session_variables) {
        try {
          const pVars = typeof payment.session_variables === 'string' ? JSON.parse(payment.session_variables) : payment.session_variables;
          paymentScreenshotUrl = pVars.payment_screenshot_url || null;
        } catch (e) {}
      }

      let isCallSupport = false;
      let callSupportProduct = 'SGB Blade Protector';
      if (paused && paused.paused_session_variables) {
        try {
          const sVars = typeof paused.paused_session_variables === 'string' ? JSON.parse(paused.paused_session_variables) : paused.paused_session_variables;
          if (sVars.is_call_support === true || sVars.call_support_requested === true || sVars.handoff_reason === 'Call Support') {
            isCallSupport = true;
            if (sVars.call_support_product) callSupportProduct = sVars.call_support_product;
          }
        } catch (e) {}
      }
      if (paused && !isCallSupport && (paused.paused_node_key === 'node-support-callback' || paused.paused_node_key === 'node-support-ack')) {
        isCallSupport = true;
      }

      return {
        ...r,
        session_status: paused ? paused.status : null,
        paused_at: paused ? paused.paused_at : null,
        paused_session_variables: paused ? paused.paused_session_variables : null,
        paused_node_key: paused ? paused.paused_node_key : null,
        is_call_support: isCallSupport,
        call_support_product: callSupportProduct,
        has_pending_payment: Boolean(payment),
        payment_order_id: payment ? payment.order_id : null,
        payment_amount: payment ? payment.total_amount : null,
        payment_order_status: payment ? payment.order_status : null,
        payment_screenshot_url: paymentScreenshotUrl
      };
    };

    // SEARCH PATH
    if (options.search) {
      const trimmedSearch = options.search.trim().toLowerCase();
      const searchDigits = trimmedSearch.replace(/\D/g, '');
      const searchPattern = `%${trimmedSearch}%`;

      let leadQuery = `SELECT l.lead_id FROM leads l WHERE 1=1`;
      let leadParams = [];

      if (isScopedUser(user)) {
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
        return { customers: [], totalCount: 0, unreadCount, handoffCount, paymentCount, page: 1, limit };
      }

      const inClause = leadIds.map(() => '?').join(',');
      const searchQuery = `
        SELECT 
          l.*, 
          l.phone_number AS phone, 
          u.name AS assigned_name,
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
        WHERE l.lead_id IN (${inClause})
        ORDER BY agg.last_message_at DESC, l.created_at DESC
      `;

      const [rows] = await db.execute(searchQuery, [...leadIds, ...leadIds]);
      return {
        customers: rows.map(mapCustomerRow),
        totalCount: rows.length,
        unreadCount,
        handoffCount,
        paymentCount,
        page: 1,
        limit
      };
    }

    // NON-SEARCH TABS:
    // Tab: handoff
    if (options.tab === 'handoff' || options.tab === 'my_handoff') {
      const handoffIds = Array.from(handoffLeadIdSet);
      if (handoffIds.length === 0) {
        return { customers: [], totalCount: 0, unreadCount, handoffCount, paymentCount, page, limit };
      }
      const inPlaceholders = handoffIds.map(() => '?').join(',');
      const [rows] = await db.execute(`
        SELECT 
          l.*, 
          l.phone_number AS phone, 
          u.name AS assigned_name,
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
          WHERE cs.lead_id IN (${inPlaceholders})
          GROUP BY cs.lead_id
        ) agg ON l.lead_id = agg.lead_id
        LEFT JOIN chat_messages cm_last ON cm_last.chat_id = agg.max_chat_id
        WHERE l.lead_id IN (${inPlaceholders})
        ORDER BY agg.last_message_at DESC, l.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [...handoffIds, ...handoffIds]);

      return {
        customers: rows.map(mapCustomerRow),
        totalCount: handoffIds.length,
        unreadCount,
        handoffCount,
        paymentCount,
        page,
        limit
      };
    }

    // Tab: payment
    if (options.tab === 'payment') {
      const paymentIds = Array.from(paymentLeadIdSet);
      if (paymentIds.length === 0) {
        return { customers: [], totalCount: 0, unreadCount, handoffCount, paymentCount, page, limit };
      }
      const inPlaceholders = paymentIds.map(() => '?').join(',');
      const [rows] = await db.execute(`
        SELECT 
          l.*, 
          l.phone_number AS phone, 
          u.name AS assigned_name,
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
          WHERE cs.lead_id IN (${inPlaceholders})
          GROUP BY cs.lead_id
        ) agg ON l.lead_id = agg.lead_id
        LEFT JOIN chat_messages cm_last ON cm_last.chat_id = agg.max_chat_id
        WHERE l.lead_id IN (${inPlaceholders})
        ORDER BY agg.last_message_at DESC, l.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [...paymentIds, ...paymentIds]);

      return {
        customers: rows.map(mapCustomerRow),
        totalCount: paymentIds.length,
        unreadCount,
        handoffCount,
        paymentCount,
        page,
        limit
      };
    }

    // Tab: unviewed
    if (options.tab === 'unviewed') {
      let unviewedLeadQuery = `
        SELECT cs.lead_id, COUNT(*) AS unread_msg_count, MAX(cm.chat_id) AS max_chat_id
        FROM chat_messages cm
        JOIN chat_sessions cs ON cm.session_id = cs.session_id
        ${isScopedUser(user) ? 'JOIN leads l ON cs.lead_id = l.lead_id' : ''}
        WHERE cm.sender_type = 'user' AND cm.status = 'sent'
        ${isScopedUser(user) ? 'AND l.assigned_to = ?' : ''}
        GROUP BY cs.lead_id
        ORDER BY max_chat_id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [unviewedLeads] = await db.execute(unviewedLeadQuery, isScopedUser(user) ? [user.id] : []);
      if (unviewedLeads.length === 0) {
        return { customers: [], totalCount: unreadCount, unreadCount, handoffCount, paymentCount, page, limit };
      }

      const targetLeadIds = unviewedLeads.map(u => u.lead_id);
      const unreadCountMap = new Map(unviewedLeads.map(u => [u.lead_id, u.unread_msg_count]));
      const inPlaceholders = targetLeadIds.map(() => '?').join(',');

      const [rows] = await db.execute(`
        SELECT 
          l.*, 
          l.phone_number AS phone, 
          u.name AS assigned_name,
          cm_last.chat_id AS max_chat_id,
          cm_last.timestamp AS last_message_at,
          cm_last.message AS last_message,
          cm_last.sender_type AS last_message_sender_type,
          cm_last.status AS last_message_status
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.user_id
        LEFT JOIN (
          SELECT cs.lead_id, MAX(cm.chat_id) AS max_chat_id
          FROM chat_sessions cs
          JOIN chat_messages cm ON cs.session_id = cm.session_id
          WHERE cs.lead_id IN (${inPlaceholders})
          GROUP BY cs.lead_id
        ) max_c ON l.lead_id = max_c.lead_id
        LEFT JOIN chat_messages cm_last ON cm_last.chat_id = max_c.max_chat_id
        WHERE l.lead_id IN (${inPlaceholders})
        ORDER BY cm_last.timestamp DESC, l.created_at DESC
      `, [...targetLeadIds, ...targetLeadIds]);

      const mapped = rows.map(r => ({
        ...mapCustomerRow(r),
        unread_msg_count: unreadCountMap.get(r.lead_id) || 0
      }));

      return {
        customers: mapped,
        totalCount: unreadCount,
        unreadCount,
        handoffCount,
        paymentCount,
        page,
        limit
      };
    }

    // Tab: resolved
    if (options.tab === 'resolved') {
      let countQuery = "SELECT COUNT(*) AS total FROM leads l WHERE l.status IN ('converted', 'closed', 'lost')";
      let countParams = [];
      if (isScopedUser(user)) {
        countQuery += " AND l.assigned_to = ?";
        countParams.push(user.id);
      }
      const [[cRow]] = await db.execute(countQuery, countParams);
      const totalCount = cRow ? parseInt(cRow.total) : 0;

      let resolvedQuery = `
        SELECT l.*, l.phone_number AS phone, u.name AS assigned_name
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.user_id
        WHERE l.status IN ('converted', 'closed', 'lost')
        ${isScopedUser(user) ? 'AND l.assigned_to = ?' : ''}
        ORDER BY l.updated_at DESC, l.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [resolvedRows] = await db.execute(resolvedQuery, isScopedUser(user) ? [user.id] : []);

      if (resolvedRows.length === 0) {
        return { customers: [], totalCount, unreadCount, handoffCount, paymentCount, page, limit };
      }

      const resLeadIds = resolvedRows.map(r => r.lead_id);
      const inPlaceholders = resLeadIds.map(() => '?').join(',');

      const [msgDetails] = await db.execute(`
        SELECT 
          cs.lead_id,
          cm.timestamp AS last_message_at,
          cm.message AS last_message,
          cm.sender_type AS last_message_sender_type,
          cm.status AS last_message_status
        FROM (
          SELECT cs.lead_id, MAX(cm.chat_id) AS max_chat_id
          FROM chat_sessions cs
          JOIN chat_messages cm ON cs.session_id = cm.session_id
          WHERE cs.lead_id IN (${inPlaceholders})
          GROUP BY cs.lead_id
        ) agg
        JOIN chat_messages cm ON agg.max_chat_id = cm.chat_id
        JOIN chat_sessions cs ON cm.session_id = cs.session_id
      `, resLeadIds);

      const msgMap = new Map(msgDetails.map(m => [m.lead_id, m]));

      const mapped = resolvedRows.map(r => {
        const msg = msgMap.get(r.lead_id) || {};
        return {
          ...mapCustomerRow(r),
          last_message_at: msg.last_message_at || null,
          last_message: msg.last_message || null,
          last_message_sender_type: msg.last_message_sender_type || null,
          last_message_status: msg.last_message_status || null,
          unread_msg_count: 0
        };
      });

      return {
        customers: mapped,
        totalCount,
        unreadCount,
        handoffCount,
        paymentCount,
        page,
        limit
      };
    }

    // Default: Tab 'all'
    let totalCountQuery = "SELECT COUNT(*) AS total FROM leads l WHERE 1=1";
    let totalCountParams = [];
    if (isScopedUser(user)) {
      totalCountQuery += " AND l.assigned_to = ?";
      totalCountParams.push(user.id);
    }
    const [[cRow]] = await db.execute(totalCountQuery, totalCountParams);
    const totalCount = cRow ? parseInt(cRow.total) : 0;

    // Scan recent messages via PK index (retrieves hundreds of distinct active leads in < 50ms)
    let recentQuery = `
      SELECT cs.lead_id, cs.session_id, MAX(cm.chat_id) as max_chat_id, MAX(cm.timestamp) as last_message_at
      FROM (
        SELECT session_id, chat_id, timestamp
        FROM chat_messages
        ORDER BY chat_id DESC
        LIMIT 3000
      ) cm
      JOIN chat_sessions cs ON cm.session_id = cs.session_id
      ${isScopedUser(user) ? 'JOIN leads l ON cs.lead_id = l.lead_id' : ''}
      ${isScopedUser(user) ? 'WHERE l.assigned_to = ?' : ''}
      GROUP BY cs.lead_id, cs.session_id
      ORDER BY max_chat_id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [recentRows] = await db.execute(recentQuery, isScopedUser(user) ? [user.id] : []);

    let targetLeadIds = recentRows.map(r => r.lead_id);

    // If offset is high or no recent messages match, fall back to leads table
    if (targetLeadIds.length === 0) {
      let fallbackQuery = `
        SELECT l.lead_id 
        FROM leads l 
        WHERE 1=1
        ${isScopedUser(user) ? 'AND l.assigned_to = ?' : ''}
        ORDER BY l.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [fallbackRows] = await db.execute(fallbackQuery, isScopedUser(user) ? [user.id] : []);
      targetLeadIds = fallbackRows.map(r => r.lead_id);
    }

    if (targetLeadIds.length === 0) {
      return { customers: [], totalCount, unreadCount, handoffCount, paymentCount, page, limit };
    }

    const inPlaceholders = targetLeadIds.map(() => '?').join(',');

    // Fetch full lead details and last messages ONLY for these 30 target leads!
    const [customerRows] = await db.execute(`
      SELECT 
        l.*, 
        l.phone_number AS phone, 
        u.name AS assigned_name,
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
        WHERE cs.lead_id IN (${inPlaceholders})
        GROUP BY cs.lead_id
      ) agg ON l.lead_id = agg.lead_id
      LEFT JOIN chat_messages cm_last ON cm_last.chat_id = agg.max_chat_id
      WHERE l.lead_id IN (${inPlaceholders})
      ORDER BY agg.last_message_at DESC, l.created_at DESC
    `, [...targetLeadIds, ...targetLeadIds]);

    return {
      customers: customerRows.map(mapCustomerRow),
      totalCount,
      unreadCount,
      handoffCount,
      paymentCount,
      page,
      limit
    };

  } catch (err) {
    logger.error('Fetch all chat customers error:', err.message, err.sql ? `SQL: ${err.sql}` : '');
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

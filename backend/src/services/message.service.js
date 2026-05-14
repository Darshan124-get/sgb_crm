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
const logChatMessage = async (phoneInput, direction, messageType, body, mediaData = null, mimeType = null, senderId = null) => {
  const phone = normalizePhone(phoneInput);
  try {
    // 1. Get Lead ID
    const [leads] = await db.execute('SELECT lead_id FROM leads WHERE phone_number = ?', [phone]);
    if (leads.length === 0) return;
    const lead_id = leads[0].lead_id;

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
    
    // Handle Supabase Upload
    let mediaUrl = null;
    let buffer = mediaData;
    
    if (mediaData) {
      if (typeof mediaData === 'string' && mediaData.startsWith('data:')) {
        buffer = Buffer.from(mediaData.split(',')[1], 'base64');
      }

      if (buffer && Buffer.isBuffer(buffer)) {
        const timestamp = Date.now();
        const extension = mimeType ? mimeType.split('/')[1] : 'bin';
        const fileName = `${timestamp}-${phone}.${extension}`;
        const filePath = `chats/${phone}/${fileName}`;

        const { data, error } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
          .upload(filePath, buffer, {
            contentType: mimeType || 'application/octet-stream',
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
      'INSERT INTO chat_messages (session_id, sender_type, sender_id, message, media_data, media_url, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      mapParams([session_id, sender_type, senderId, body, (mediaUrl ? null : buffer), mediaUrl, mimeType])
    );
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
  try {
    let query = `
      SELECT cm.*, 
      CASE WHEN cm.sender_type = 'user' THEN 'incoming' ELSE 'outgoing' END as direction, 
      cm.message as body,
      u.name as sender_name
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.session_id
      JOIN leads l ON cs.lead_id = l.lead_id
      LEFT JOIN users u ON cm.sender_id = u.user_id
      WHERE l.phone_number = ?
    `;
    let params = [phone];

    if (user && user.role.toLowerCase() === 'sales') {
      query += " AND l.assigned_to = ?";
      params.push(user.id);
    }

    query += " ORDER BY cm.timestamp ASC LIMIT 100";

    const [rows] = await db.execute(query, params);
    return rows;
  } catch (err) {
    logger.error('Fetch chat history error:', err.message);
    throw err;
  }
};

/**
 * Gets a list of all leads who have chats
 */
const getAllChatCustomers = async (user = null) => {
  try {
    let query = `
      SELECT l.*, l.phone_number AS phone, u.name AS assigned_name,
       MAX(cm.timestamp) as last_message_at,
       (SELECT message FROM chat_messages WHERE session_id IN (SELECT session_id FROM chat_sessions WHERE lead_id = l.lead_id) ORDER BY timestamp DESC LIMIT 1) as last_message
       FROM leads l
       LEFT JOIN chat_sessions cs ON l.lead_id = cs.lead_id
       LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
       LEFT JOIN users u ON l.assigned_to = u.user_id
       WHERE 1=1
    `;
    let params = [];

    if (user && user.role.toLowerCase() === 'sales') {
      query += " AND l.assigned_to = ?";
      params.push(user.id);
    }

    query += `
       GROUP BY l.lead_id
       ORDER BY last_message_at DESC, l.created_at DESC
    `;

    const [rows] = await db.execute(query, params);
    return rows;
  } catch (err) {
    logger.error('Fetch all chat customers error:', err.message);
    throw err;
  }
};

const deleteChatMessage = async (chatId) => {
  await db.execute('DELETE FROM chat_messages WHERE chat_id = ?', [chatId]);
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
  deleteChatMessage
};

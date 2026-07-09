const whatsappService = require('../services/whatsapp.service');
const messageService = require('../services/message.service');
const logger = require('../utils/whatsappLogger');
const { normalizePhone, formatForWhatsApp } = require('../utils/phoneUtils');
const pool = require('../config/db');

/**
 * Handles Meta/WhatsApp Webhook Verification (GET)
 */
const verifyWebhook = (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook verified successfully!');
      res.status(200).send(challenge);
    } else {
      logger.error('Verification failed: Inconsistent token or mode.');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(403);
  }
};

/**
 * Handles incoming WhatsApp Message Events (POST)
 */
const receiveMessage = async (req, res) => {
  const body = req.body;

  // Check if it's a WhatsApp message event
  if (body.object === 'whatsapp_business_account' && body.entry) {
    for (const entry of body.entry) {
      for (const change of (entry.changes || [])) {
        const value = change.value;

        // Handle message statuses (sent, delivered, read)
        if (value.statuses) {
          for (const statusObj of value.statuses) {
            const { id, status } = statusObj;
            try {
              await messageService.updateMessageStatus(id, status);
              logger.info(`Message ${id} status updated to ${status}`);
            } catch (err) {
              logger.error(`Failed to update message status for ${id}:`, err.message);
            }
          }
        }

        if (!value.messages) continue;

        for (const msg of value.messages) {
          const fromNumber = normalizePhone(msg.from);
          const timestamp = msg.timestamp;

          let inputText = '';
          let mediaBuffer = null;
          let mimeType = null;

          // 1. Parse Input Type
          if (msg.type === 'text') {
            inputText = msg.text.body;
          } else if (msg.type === 'interactive') {
            const interactive = msg.interactive;
            inputText = interactive.button_reply?.title || interactive.list_reply?.title || 'Interactive response';
          } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(msg.type)) {
            const mediaId = msg[msg.type].id;
            const caption = msg[msg.type].caption || '';
            inputText = caption || `Sent a ${msg.type}`;

            try {
              const media = await whatsappService.downloadMedia(mediaId);
              mediaBuffer = media.buffer;
              mimeType = media.mimeType;
            } catch (mediaErr) {
              logger.error(`Failed to download incoming media ${mediaId}:`, mediaErr.message);
            }
          } else {
            inputText = `Media/Other type: ${msg.type}`;
          }

          try {
            // 2. Store as Lead (Requirement: Any message creates/updates a lead)
            await messageService.storeMessageAsLead(fromNumber, inputText);

            // 3. Log to Chat History
            await messageService.logChatMessage(fromNumber, 'incoming', msg.type, inputText, mediaBuffer, mimeType);

            // 4. Bot actions skipped as per requirement
            logger.info(`Message received from ${fromNumber}: ${inputText}`);

          } catch (err) {
            logger.error(`Error processing message from ${fromNumber}:`, err.message);
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};

/**
 * Internal API: Get all customers with their last message info
 */
const getCustomers = async (req, res) => {
  try {
    const customers = await messageService.getAllChatCustomers(req.user);
    res.json(customers);
  } catch (err) {
    logger.error('API Error (getCustomers):', err.message);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

/**
 * Internal API: Get chat history for a specific customer
 */
const getHistory = async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  try {
    const history = await messageService.getChatHistory(phone, req.user);
    res.json(history);
  } catch (err) {
    logger.error('API Error (getHistory):', err.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

/**
 * Internal API: Send a manual reply from the agent (supports text and media)
 */
const sendReply = async (req, res) => {
  const { phone, message, mediaData, mimeType } = req.body;

  if (!phone || (!message && !mediaData)) {
    return res.status(400).json({ error: 'Phone and either message or media are required' });
  }

  try {
    // 1. Handle Media Sending
    if (mediaData) {
      const category = mimeType && mimeType.startsWith('image') ? 'image' :
        mimeType && mimeType.startsWith('video') ? 'video' :
          mimeType && mimeType.startsWith('audio') ? 'audio' : 'document';

      let mediaId;
      if (typeof mediaData === 'string' && mediaData.startsWith('http')) {
        mediaId = mediaData;
      } else {
        // Convert Base64 to Buffer
        const base64Data = mediaData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        mediaId = await whatsappService.uploadMedia(buffer, mimeType, category, message || 'file');
      }

      const waPhone = formatForWhatsApp(phone);
      const metaResponse = await whatsappService.sendMediaMessage(waPhone, mediaId, category, message);
      console.log('MEDIA META RESPONSE:', JSON.stringify(metaResponse));
      const metaMessageId = metaResponse?.messages?.[0]?.id || null;
      console.log('MEDIA META MESSAGE ID:', metaMessageId);

      // Log to local Chat History (Use normalized number for DB)
      await messageService.logChatMessage(normalizePhone(phone), 'outgoing', category, message || '', mediaData, mimeType, req.user.id, metaMessageId, 'sent');
    }
    // 2. Handle Text Sending
    else if (message) {
      const waPhone = formatForWhatsApp(phone);
      const metaResponse = await whatsappService.sendMessage(waPhone, message);
      logger.info('TEXT META RESPONSE:', metaResponse);
      const metaMessageId = metaResponse?.messages?.[0]?.id || null;
      logger.info('TEXT META MESSAGE ID:', metaMessageId);
      await messageService.logChatMessage(normalizePhone(phone), 'outgoing', 'text', message, null, null, req.user.id, metaMessageId, 'sent');
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('API Error (sendReply):', err);
    res.status(500).json({ error: 'Failed to send message: ' + err.message, stack: err.stack });
  }
};

/**
 * Internal API: Serve media data from the database
 */
const getMedia = async (req, res) => {
  const { chatId } = req.params;
  try {
    const db = require('../config/db');
    const [rows] = await db.execute('SELECT media_data, media_url, mime_type FROM chat_messages WHERE chat_id = ?', [chatId]);
    if (rows.length === 0) {
      return res.status(404).send('Media not found');
    }

    const { media_data, media_url, mime_type } = rows[0];

    // Priority 1: Supabase URL
    if (media_url) {
      return res.redirect(media_url);
    }

    // Priority 2: Database BLOB (Legacy)
    if (media_data) {
      res.setHeader('Content-Type', mime_type || 'application/octet-stream');
      return res.send(media_data);
    }

    res.status(404).send('Media content is empty');
  } catch (err) {
    logger.error('API Error (getMedia):', err.message);
    res.status(500).send('Error retrieving media');
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    await messageService.deleteChatMessage(chatId);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    logger.error(`Error deleting message ${req.params.chatId}:`, err.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

const getQuickReplies = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM whatsapp_quick_replies ORDER BY shortcut ASC');
    res.json(rows);
  } catch (err) {
    logger.error('Error fetching quick replies:', err.message);
    res.status(500).json({ error: 'Failed to fetch quick replies' });
  }
};

const saveQuickReply = async (req, res) => {
  try {
    const { id, shortcut, message, mediaData, mimeType } = req.body;
    if (!shortcut) {
      return res.status(400).json({ error: 'Shortcut is required' });
    }

    let mediaUrl = null;
    let mediaType = null;

    if (mediaData) {
      const supabase = require('../config/supabase');
      const dataArray = Array.isArray(mediaData) ? mediaData : [mediaData];
      const typeArray = Array.isArray(mimeType) ? mimeType : [mimeType];

      let uploadedUrls = [];
      let mappedTypes = [];

      for (let i = 0; i < dataArray.length; i++) {
        const mData = dataArray[i];
        const mType = typeArray[i] || 'application/octet-stream';

        if (mData.startsWith('http')) {
          uploadedUrls.push(mData);
          mappedTypes.push(mType.startsWith('image') ? 'image' :
            mType.startsWith('video') ? 'video' :
              mType.startsWith('audio') ? 'audio' : 'document');
          continue;
        }

        const buffer = Buffer.from(mData.split(',')[1], 'base64');
        const extension = mType ? mType.split('/')[1] : 'bin';
        const fileName = `quick-replies/${Date.now()}-${shortcut}-${i}.${extension}`;

        const { error } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
          .upload(fileName, buffer, {
            contentType: mType,
            upsert: true
          });

        if (error) {
          logger.error('Supabase upload error in quick replies:', error.message);
          throw error;
        }

        const { data: urlData } = supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
        mappedTypes.push(mType.startsWith('image') ? 'image' :
          mType.startsWith('video') ? 'video' :
            mType.startsWith('audio') ? 'audio' : 'document');
      }

      mediaUrl = JSON.stringify(uploadedUrls);
      mediaType = JSON.stringify(mappedTypes);
    }

    if (id) {
      if (mediaData) {
        await pool.query('UPDATE whatsapp_quick_replies SET shortcut=?, message=?, media_url=?, media_type=? WHERE id=?', [shortcut, message, mediaUrl, mediaType, id]);
        res.json({ id, shortcut, message, media_url: mediaUrl, media_type: mediaType });
      } else {
        await pool.query('UPDATE whatsapp_quick_replies SET shortcut=?, message=? WHERE id=?', [shortcut, message, id]);
        const [rows] = await pool.query('SELECT * FROM whatsapp_quick_replies WHERE id=?', [id]);
        res.json(rows[0]);
      }
    } else {
      const [result] = await pool.query('INSERT INTO whatsapp_quick_replies (shortcut, message, media_url, media_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE message=VALUES(message), media_url=VALUES(media_url), media_type=VALUES(media_type)', [shortcut, message, mediaUrl, mediaType]);
      res.json({ id: result.insertId, shortcut, message, media_url: mediaUrl, media_type: mediaType });
    }
  } catch (err) {
    logger.error('Error saving quick reply:', err.message);
    res.status(500).json({ error: 'Failed to save quick reply' });
  }
};

const deleteQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM whatsapp_quick_replies WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting quick reply:', err.message);
    res.status(500).json({ error: 'Failed to delete quick reply' });
  }
};

const markRead = async (req, res) => {
  try {
    const { phone } = req.params;
    await messageService.markMessagesAsRead(phone);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error in markRead:', err.message);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage,
  getCustomers,
  getHistory,
  sendReply,
  getMedia,
  deleteMessage,
  getQuickReplies,
  saveQuickReply,
  deleteQuickReply,
  markRead
};

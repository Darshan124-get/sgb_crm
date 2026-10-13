const whatsappService = require('../services/whatsapp.service');
const messageService = require('../services/message.service');
const logger = require('../utils/whatsappLogger');
const { normalizePhone, formatForWhatsApp } = require('../utils/phoneUtils');
const pool = require('../config/db');
const deliveryNotifier = require('../utils/deliveryNotifier');

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

// Message deduplication cache to prevent Meta webhook retries from triggering duplicate auto-replies
const processedMsgIds = new Set();

/**
 * Handles incoming WhatsApp Message Events (POST)
 */
const receiveMessage = async (req, res) => {
  const body = req.body;

  // Acknowledge Meta webhook immediately to prevent Meta from retrying and causing duplicate messages
  if (body.object === 'whatsapp_business_account') {
    res.status(200).send('EVENT_RECEIVED');
  } else {
    return res.sendStatus(404);
  }

  if (!body.entry) return;

  try {
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
              if (status === 'delivered' || status === 'read') {
                deliveryNotifier.emit(`delivered:${id}`, status);
              }
            } catch (err) {
              logger.error(`Failed to update message status for ${id}:`, err.message);
            }
          }
        }

        if (!value.messages) continue;

        for (const msg of value.messages) {
          // Deduplicate incoming messages using Meta message ID
          if (msg.id) {
            if (processedMsgIds.has(msg.id)) {
              logger.info(`Duplicate Meta message ID ${msg.id} ignored.`);
              continue;
            }
            processedMsgIds.add(msg.id);
            // Limit cache size to prevent memory leak (keep last 5000 message IDs)
            if (processedMsgIds.size > 5000) {
              const firstVal = processedMsgIds.values().next().value;
              processedMsgIds.delete(firstVal);
            }
          }

          const fromNumber = normalizePhone(msg.from);
          const timestamp = msg.timestamp;

          let inputText = '';
          let mediaBuffer = null;
          let mimeType = null;

          let parsedFlowData = null;

          // 1. Parse Input Type
          if (msg.type === 'text') {
            inputText = msg.text.body;
          } else if (msg.type === 'interactive') {
            const interactive = msg.interactive;
            if (interactive.type === 'nfm_reply' && interactive.nfm_reply?.response_json) {
              try {
                parsedFlowData = typeof interactive.nfm_reply.response_json === 'string'
                  ? JSON.parse(interactive.nfm_reply.response_json)
                  : interactive.nfm_reply.response_json;
                
                const name = parsedFlowData.customer_name || '';
                const addr = parsedFlowData.delivery_address || '';
                const pin = parsedFlowData.pincode || '';
                inputText = `Name: ${name}\nAddress: ${addr}\nPIN: ${pin}\nConfirmed: Yes`;
                logger.info(`Received native WhatsApp Flow submission for ${fromNumber}: ${name}, ${addr}, ${pin}`);
              } catch (e) {
                logger.error('Failed to parse Flow response_json:', e.message);
                inputText = interactive.nfm_reply.body || 'Flow submitted';
              }
            } else {
              inputText = interactive.button_reply?.title || interactive.list_reply?.title || 'Interactive response';
            }
          } else if (['image', 'document', 'audio', 'video', 'sticker', 'voice'].includes(msg.type)) {
            const mediaId = msg[msg.type]?.id;
            const caption = msg[msg.type]?.caption || '';
            inputText = caption || `Sent a ${msg.type}`;
            mimeType = msg[msg.type]?.mime_type || null;

            if (mediaId) {
              try {
                const media = await whatsappService.downloadMedia(mediaId);
                mediaBuffer = media.buffer;
                if (media.mimeType) mimeType = media.mimeType;
              } catch (mediaErr) {
                logger.error(`Failed to download incoming media ${mediaId}:`, mediaErr.message);
              }
            }
          } else {
            inputText = `Media/Other type: ${msg.type}`;
          }

          try {
            // Check if this incoming message is a reply to another message
            let replyToChatId = null;
            if (msg.context && msg.context.id) {
              const [parentRows] = await pool.query('SELECT chat_id FROM chat_messages WHERE message_id = ?', [msg.context.id]);
              if (parentRows.length > 0) {
                replyToChatId = parentRows[0].chat_id;
              }
            }

            // 2. Store as Lead (Requirement: Any message creates/updates a lead)
            await messageService.storeMessageAsLead(fromNumber, inputText);

            // 3. Log to Chat History (pass msg.id as the messageId parameter, and replyToChatId)
            await messageService.logChatMessage(fromNumber, 'incoming', msg.type, inputText, mediaBuffer, mimeType, null, msg.id, 'sent', replyToChatId);

            // 3b. Trigger Chatbot Flow Engine
            try {
              const FlowEngine = require('../services/FlowEngine');
              let mediaUrl = null;
              if (msg.type && ['image', 'document', 'audio', 'video'].includes(msg.type)) {
                mediaUrl = `https://graph.facebook.com/v21.0/${msg[msg.type].id}`;
              }
              await FlowEngine.handleMessage(fromNumber, inputText, mediaUrl, {
                msgType: msg.type,
                mimeType,
                mediaBuffer,
                messageId: msg.id,
                mediaId: msg[msg.type]?.id,
                flowData: parsedFlowData
              });
            } catch (err) {
              logger.error(`FlowEngine execution failed for ${fromNumber}:`, err.message);
            }

            // 4. Campaign Auto-Replies Check (ONLY for ACTIVE campaigns)
            logger.info(`Message received from ${fromNumber}: ${inputText}`);

            if (!global._activeCampaignsCache || (Date.now() - (global._activeCampaignsCacheTime || 0) > 60000)) {
              try {
                const [campaignRows] = await pool.query('SELECT * FROM campaigns WHERE status = "active" AND auto_replies IS NOT NULL AND auto_replies != \'[]\' ORDER BY id DESC');
                global._activeCampaignsCache = campaignRows;
                global._activeCampaignsCacheTime = Date.now();
              } catch (cErr) {
                logger.error('Error fetching active campaigns cache:', cErr.message);
              }
            }
            const campaigns = global._activeCampaignsCache || [];
            let matchedCampaign = null;

            if (inputText) {
              const normalizedInput = inputText.toLowerCase().trim();
              for (const campaign of campaigns) {
                if (campaign.tag_line) {
                  const tagLine = campaign.tag_line.toLowerCase().trim();
                  // STRICT EXACT MATCH ONLY: message must equal campaign tag_line exactly
                  if (tagLine && normalizedInput === tagLine) {
                    matchedCampaign = campaign;
                    break;
                  }
                }
              }
            }

            if (matchedCampaign && matchedCampaign.auto_replies) {
              logger.info(`Matched ACTIVE campaign ${matchedCampaign.campaign_id} (ID: ${matchedCampaign.id}) for number ${fromNumber}`);
              let autoReplies = [];
              try {
                autoReplies = typeof matchedCampaign.auto_replies === 'string' ? JSON.parse(matchedCampaign.auto_replies) : matchedCampaign.auto_replies;
              } catch (e) {
                logger.error(`Error parsing auto_replies for campaign ${matchedCampaign.campaign_id}:`, e.message);
              }

              if (Array.isArray(autoReplies)) {
                for (const reply of autoReplies) {
                  try {
                    if (reply.type === 'text') {
                      await whatsappService.sendMessage(formatForWhatsApp(fromNumber), reply.content, null, -2);
                    } else if (reply.type === 'image' || reply.type === 'video') {
                      if (reply.url) {
                        await whatsappService.sendMediaMessage(formatForWhatsApp(fromNumber), reply.url, reply.type, reply.caption, null, -2);
                      }
                    }

                    // Pacing delay (1.5s) so media messages arrive cleanly in order
                    await new Promise(resolve => setTimeout(resolve, 1500));
                  } catch (sendErr) {
                    logger.error(`Error sending campaign auto-reply to ${fromNumber}:`, sendErr.message);
                  }
                }
              }
            }

          } catch (err) {
            logger.error(`Error processing message from ${fromNumber}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error handling webhook event:', err.message);
  }
};

/**
 * Internal API: Get all customers with their last message info
 */
const getCustomers = async (req, res) => {
  try {
    const options = {
      limit: req.query.limit,
      page: req.query.page,
      search: req.query.search,
      tab: req.query.tab
    };
    const customers = await messageService.getAllChatCustomers(req.user, options);
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
  const { phone, message, mediaData, mimeType, reply_to_chat_id, is_forwarded, quick_reply_shortcut, quick_reply_name } = req.body;
  const staffUserId = req.user ? (req.user.id || req.user.user_id) : null;
  const qrName = quick_reply_shortcut || quick_reply_name || null;

  if (!phone || (!message && !mediaData)) {
    return res.status(400).json({ error: 'Phone and either message or media are required' });
  }

  try {
    // Retrieve the Meta message ID to quote/reply to the message on WhatsApp
    let replyToMessageId = null;
    if (reply_to_chat_id) {
      const [replyRows] = await pool.query('SELECT message_id FROM chat_messages WHERE chat_id = ?', [reply_to_chat_id]);
      if (replyRows.length > 0) {
        replyToMessageId = replyRows[0].message_id;
      }
    }

    // Determine type: text vs media
    const category = mimeType ? (mimeType.startsWith('image') ? 'image' : (mimeType.startsWith('video') ? 'video' : (mimeType.startsWith('audio') ? 'audio' : 'document'))) : null;

    // 1. Handle Media Sending
    if (mediaData && category) {
      let mediaId;
      let mediaBuffer = null;
      if (typeof mediaData === 'string' && (mediaData.startsWith('http') || mediaData.startsWith('/api/media/') || mediaData.includes('quick-replies/') || mediaData.includes('chats/'))) {
        mediaId = mediaData;
      } else if (typeof mediaData === 'string' && mediaData.includes(',')) {
        const base64Data = mediaData.split(',')[1];
        mediaBuffer = Buffer.from(base64Data, 'base64');
        mediaId = await whatsappService.uploadMedia(mediaBuffer, mimeType, category, message || 'file');
      } else if (typeof mediaData === 'string') {
        mediaBuffer = Buffer.from(mediaData, 'base64');
        mediaId = await whatsappService.uploadMedia(mediaBuffer, mimeType, category, message || 'file');
      } else if (Buffer.isBuffer(mediaData)) {
        mediaBuffer = mediaData;
        mediaId = await whatsappService.uploadMedia(mediaBuffer, mimeType, category, message || 'file');
      }

      const waPhone = formatForWhatsApp(phone);
      await whatsappService.sendMediaMessage(waPhone, mediaId, category, message, replyToMessageId, staffUserId, mediaBuffer, mimeType, qrName);
    }
    // 2. Handle Text Sending
    else if (message) {
      const waPhone = formatForWhatsApp(phone);
      await whatsappService.sendMessage(waPhone, message, replyToMessageId, staffUserId, qrName);
    }

    // Auto-pause active chatbot session when human agent sends a manual reply
    try {
      const FlowEngine = require('../services/FlowEngine');
      await FlowEngine.pauseSessionForAgent(phone);
    } catch (pauseErr) {
      console.warn('Auto bot pause error:', pauseErr.message);
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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Priority 1: Cloudflare R2 / Storage Service
    if (media_url) {
      const storageService = require('../services/storage.service');
      const key = storageService.extractKeyFromUrl(media_url);
      try {
        const r2Data = await storageService.downloadObject({ key });
        res.setHeader('Content-Type', r2Data.contentType || mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', r2Data.contentLength);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(r2Data.buffer);
      } catch (r2Err) {
        logger.warn(`R2 fetch failed for key '${key}', attempting fallback redirect: ${r2Err.message}`);
        if (media_url.startsWith('http') && !media_url.includes('.r2.cloudflarestorage.com')) {
          return res.redirect(media_url);
        }
      }
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

/**
 * Public Streamer: Fetch & stream media from Meta Graph API using WhatsApp Cloud Token
 */
const getMetaMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    if (!mediaId) return res.status(400).send('Missing media ID');

    const cleanId = String(mediaId).split('/').pop().replace(/\D/g, '');
    if (!cleanId) return res.status(400).send('Invalid media ID');

    const whatsappService = require('../services/whatsapp.service');
    const { buffer, mimeType } = await whatsappService.downloadMedia(cleanId);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', mimeType || 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    logger.error(`Error streaming Meta media (${req.params.mediaId}):`, err.message);
    res.status(500).send('Failed to load media');
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const deleteType = req.query.deleteType || req.body?.deleteType || 'for_me';

    if (deleteType === 'for_everyone') {
      const db = require('../config/db');
      const [rows] = await db.execute('SELECT chat_id, message_id, sender_type FROM chat_messages WHERE chat_id = ?', [chatId]);
      if (rows.length > 0) {
        const msg = rows[0];
        if (msg.message_id) {
          try {
            await whatsappService.deleteMessageForEveryone(msg.message_id);
          } catch (waErr) {
            logger.warn(`Could not delete message on WhatsApp API: ${waErr.message}`);
          }
        }
      }
    }

    await messageService.deleteChatMessage(chatId);
    res.json({ success: true, message: deleteType === 'for_everyone' ? 'Message deleted for everyone' : 'Message deleted for me' });
  } catch (err) {
    logger.error(`Error deleting message ${req.params.chatId}:`, err.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

const getQuickReplies = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM whatsapp_quick_replies ORDER BY shortcut ASC');
    const storageService = require('../services/storage.service');
    const processedRows = rows.map(row => {
      if (row.media_url) {
        try {
          const parsed = JSON.parse(row.media_url);
          if (Array.isArray(parsed)) {
            const formatted = parsed.map(url => {
              if (!url) return url;
              if (url.startsWith('/api/media/')) return url;
              const key = storageService.extractKeyFromUrl(url);
              return `/api/media/${key}`;
            });
            return { ...row, media_url: JSON.stringify(formatted) };
          }
        } catch (e) {}
      }
      return row;
    });
    res.json(processedRows);
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
      const storageService = require('../services/storage.service');
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

        const uploadResult = await storageService.uploadObject({
          key: fileName,
          body: buffer,
          contentType: mType
        });

        uploadedUrls.push(uploadResult.publicUrl);
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

const markUnread = async (req, res) => {
  try {
    const { phone } = req.params;
    await messageService.markMessagesAsUnread(phone);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error in markUnread:', err.message);
    res.status(500).json({ error: 'Failed to mark messages as unread' });
  }
};

/**
 * Verify a customer's payment screenshot for Blade Protector order
 */
const verifyPayment = async (req, res) => {
  const { phone, orderId, notes } = req.body;
  const staffUserId = req.user ? (req.user.id || req.user.user_id) : null;
  const phoneTen = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  try {
    // 1. Update orders table
    if (orderId) {
      await pool.query(
        'UPDATE orders SET order_status = "confirmed", balance_amount = 0, advance_amount = total_amount, updated_at = NOW() WHERE order_id = ?',
        [orderId]
      );
    } else if (phoneTen) {
      await pool.query(
        'UPDATE orders SET order_status = "confirmed", balance_amount = 0, advance_amount = total_amount, updated_at = NOW() WHERE purchase_source = "whatsapp_chatbot" AND phone LIKE ? AND order_status = "in_review"',
        [`%${phoneTen}`]
      );
    }

    // 2. Update chatbot_sessions: complete session and clear handoff flags
    if (phoneTen) {
      const [sessions] = await pool.query(
        'SELECT session_id, variables FROM chatbot_sessions WHERE phone LIKE ? ORDER BY session_id DESC LIMIT 1',
        [`%${phoneTen}`]
      );
      if (sessions.length > 0) {
        let vars = {};
        try {
          vars = typeof sessions[0].variables === 'string' ? JSON.parse(sessions[0].variables) : (sessions[0].variables || {});
        } catch (e) {}
        vars.payment_verification_status = 'verified';
        vars.payment_verified_at = new Date().toISOString();
        vars.payment_verified_by = staffUserId;
        vars.payment_verified_notes = notes || null;
        vars.needs_payment_verification = false;
        delete vars.is_call_support;
        delete vars.call_support_requested;
        delete vars.handoff_reason;

        await pool.query(
          'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW(), paused_at = NULL, variables = ? WHERE session_id = ?',
          [JSON.stringify(vars), sessions[0].session_id]
        );
      }

      // Ensure any other active or paused sessions for this phone are also closed
      await pool.query(
        'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW(), paused_at = NULL WHERE (phone LIKE ? OR phone = ?) AND (status = "paused_for_human" OR status = "active")',
        [`%${phoneTen}`, phoneTen]
      );

      // 3. Update lead status out of human_needed to converted/assigned
      await pool.query(
        'UPDATE leads SET status = CASE WHEN status = "human_needed" THEN "converted" ELSE status END WHERE phone_number LIKE ?',
        [`%${phoneTen}`]
      );
    }

    logger.info(`[Payment Verification] Verified payment for phone ${phone || phoneTen}, orderId: ${orderId}`);
    res.json({ success: true, message: 'Payment verified successfully. Order confirmed.' });
  } catch (err) {
    logger.error('Error verifying payment:', err.message);
    res.status(500).json({ error: 'Failed to verify payment', details: err.message });
  }
};

/**
 * Reject a customer's payment screenshot for Blade Protector order
 */
const rejectPayment = async (req, res) => {
  const { phone, orderId, reason } = req.body;
  const staffUserId = req.user ? (req.user.id || req.user.user_id) : null;
  const phoneTen = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  try {
    // 1. Update orders table
    if (orderId) {
      await pool.query(
        'UPDATE orders SET order_status = "cancelled", updated_at = NOW() WHERE order_id = ?',
        [orderId]
      );
    } else if (phoneTen) {
      await pool.query(
        'UPDATE orders SET order_status = "cancelled", updated_at = NOW() WHERE purchase_source = "whatsapp_chatbot" AND phone LIKE ? AND order_status = "in_review"',
        [`%${phoneTen}`]
      );
    }

    // 2. Update chatbot_sessions: complete session and clear handoff flags
    if (phoneTen) {
      const [sessions] = await pool.query(
        'SELECT session_id, variables FROM chatbot_sessions WHERE phone LIKE ? ORDER BY session_id DESC LIMIT 1',
        [`%${phoneTen}`]
      );
      if (sessions.length > 0) {
        let vars = {};
        try {
          vars = typeof sessions[0].variables === 'string' ? JSON.parse(sessions[0].variables) : (sessions[0].variables || {});
        } catch (e) {}
        vars.payment_verification_status = 'rejected';
        vars.payment_rejected_at = new Date().toISOString();
        vars.payment_rejected_reason = reason || 'Payment screenshot rejected by staff';
        vars.payment_rejected_by = staffUserId;
        vars.needs_payment_verification = false;
        delete vars.is_call_support;
        delete vars.call_support_requested;
        delete vars.handoff_reason;

        await pool.query(
          'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW(), paused_at = NULL, variables = ? WHERE session_id = ?',
          [JSON.stringify(vars), sessions[0].session_id]
        );
      }

      // Ensure any other active or paused sessions for this phone are also closed
      await pool.query(
        'UPDATE chatbot_sessions SET status = "completed", completed_at = NOW(), paused_at = NULL WHERE (phone LIKE ? OR phone = ?) AND (status = "paused_for_human" OR status = "active")',
        [`%${phoneTen}`, phoneTen]
      );

      // 3. Clear human_needed from lead
      await pool.query(
        'UPDATE leads SET status = CASE WHEN status = "human_needed" THEN "assigned" ELSE status END WHERE phone_number LIKE ?',
        [`%${phoneTen}`]
      );

      // 4. Send WhatsApp rejection message to customer
      try {
        const whatsappService = require('../services/whatsapp.service');
        const rejectMsg = `⚠️ *Payment Verification Update*\n\nYour payment screenshot could not be verified.\n*Reason:* ${reason || 'Invalid screenshot or payment not received'}.\n\nPlease send a clear payment screenshot or contact our support team.`;
        await whatsappService.sendMessage(phone || phoneTen, rejectMsg, null, -1);
      } catch (msgErr) {
        logger.error('[Payment Verification] Rejection message error:', msgErr.message);
      }
    }

    logger.info(`[Payment Verification] Rejected payment for phone ${phone || phoneTen}, orderId: ${orderId}, reason: ${reason}`);
    res.json({ success: true, message: 'Payment marked as rejected. Order cancelled.' });
  } catch (err) {
    logger.error('Error rejecting payment:', err.message);
    res.status(500).json({ error: 'Failed to reject payment', details: err.message });
  }
};

/**
 * Get summary of pending payment verifications for live floating alerts & topbar counts
 */
const getPendingPaymentSummary = async (req, res) => {
  try {
    const [countRows] = await pool.query(
      "SELECT COUNT(DISTINCT phone) AS total_pending FROM orders WHERE purchase_source = 'whatsapp_chatbot' AND order_status = 'in_review'"
    );
    const count = countRows[0] ? parseInt(countRows[0].total_pending) : 0;

    let pending = [];
    let latest = null;

    if (count > 0) {
      const [latestRows] = await pool.query(`
        SELECT 
          o.order_id,
          o.phone,
          o.customer_name,
          o.total_amount,
          o.order_status,
          o.created_at,
          o.updated_at,
          cs.variables
        FROM orders o
        LEFT JOIN (
          SELECT phone, MAX(session_id) as max_session_id
          FROM chatbot_sessions
          GROUP BY phone
        ) cs_max ON (cs_max.phone COLLATE utf8mb4_unicode_ci = o.phone COLLATE utf8mb4_unicode_ci OR cs_max.phone COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', RIGHT(o.phone, 10)) COLLATE utf8mb4_unicode_ci)
        LEFT JOIN chatbot_sessions cs ON cs.session_id = cs_max.max_session_id
        WHERE o.purchase_source = 'whatsapp_chatbot' AND o.order_status = 'in_review'
        ORDER BY GREATEST(COALESCE(o.updated_at, '1970-01-01'), COALESCE(o.created_at, '1970-01-01')) DESC, o.order_id DESC
        LIMIT 10
      `);

      for (const row of latestRows) {
        let screenshotUrl = null;
        let customerName = row.customer_name || 'WhatsApp Customer';
        if (row.variables) {
          try {
            const v = typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables;
            if (v.customer_name) customerName = v.customer_name;
            screenshotUrl = v.payment_screenshot_url || null;
          } catch (e) {}
        }

        // Try getting actual image from chat_messages if available
        const phoneTen = String(row.phone || '').replace(/\D/g, '').slice(-10);
        if (phoneTen) {
          const [cmRows] = await pool.query(
            "SELECT cm.chat_id, cm.media_url FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.session_id JOIN leads l ON cs.lead_id = l.lead_id WHERE (l.phone_number LIKE ? OR l.phone_number = ?) AND cm.sender_type = 'user' AND cm.message_type = 'image' ORDER BY cm.chat_id DESC LIMIT 1",
            [`%${phoneTen}`, row.phone]
          );
          if (cmRows.length > 0 && cmRows[0].media_url) {
            screenshotUrl = cmRows[0].media_url;
          }
        }

        if (screenshotUrl && screenshotUrl.includes('graph.facebook.com')) {
          const mediaId = screenshotUrl.split('/').pop().replace(/\D/g, '');
          if (mediaId) {
            screenshotUrl = `/api/whatsapp/meta-media/${mediaId}`;
          }
        }

        pending.push({
          order_id: row.order_id,
          order_number: `SGB-${row.order_id}`,
          customer_name: customerName,
          phone: row.phone,
          total_amount: parseFloat(row.total_amount) || 600,
          screenshot_url: screenshotUrl,
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      }

      latest = pending.length > 0 ? pending[0] : null;
    }

    res.json({
      success: true,
      count,
      pending,
      latest
    });
  } catch (err) {
    logger.error('Error fetching pending payment summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending payment summary' });
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage,
  getCustomers,
  getHistory,
  sendReply,
  getMedia,
  getMetaMedia,
  deleteMessage,
  getQuickReplies,
  saveQuickReply,
  deleteQuickReply,
  markRead,
  markUnread,
  verifyPayment,
  rejectPayment,
  getPendingPaymentSummary
};

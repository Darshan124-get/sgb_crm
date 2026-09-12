const axios = require('axios');
const logger = require('../utils/whatsappLogger');
const messageService = require('./message.service');

const { formatForWhatsApp } = require('../utils/phoneUtils');

const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const getToken = () => process.env.WHATSAPP_TOKEN;
const getPhoneId = () => process.env.PHONE_NUMBER_ID;

/**
 * Sends a text message to a WhatsApp recipient
 */
const sendMessage = async (to, text, replyToMessageId = null, senderId = null, quickReplyName = null) => {
  try {
    const recipient = formatForWhatsApp(to);
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { body: text },
    };

    if (replyToMessageId) {
      data.context = { message_id: replyToMessageId };
    }

    const response = await axios.post(`${BASE_URL}/${getPhoneId()}/messages`, data, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    const metaMsgId = response.data?.messages?.[0]?.id || null;
    await messageService.logChatMessage(to, 'outgoing', 'text', text, null, null, senderId, metaMsgId, 'sent', null, 0, quickReplyName).catch(err => logger.error('Error logging outgoing bot message:', err.message));

    logger.info(`Text message sent to ${to}: ${response.status}`);
    return response.data;
  } catch (err) {
    logger.error('Error sending WhatsApp text message:', err.response ? err.response.data : err.message);
    throw err;
  }
};

/**
 * Uploads media to Meta's servers to get a media_id
 * @param {Buffer} buffer The file buffer
 * @param {string} mimeType The exact MIME type (e.g. 'image/jpeg')
 * @param {string} category The Meta category ('image', 'document', 'video', 'audio')
 * @param {string} fileName Optional filename
 */
const uploadMedia = async (buffer, mimeType, category, fileName = 'file.jpg') => {
  try {
    let finalFileName = fileName || 'file.jpg';
    if (!finalFileName.includes('.')) {
      const ext = category === 'image' ? (mimeType && mimeType.includes('png') ? 'png' : 'jpg') : (category === 'video' ? 'mp4' : (category === 'audio' ? 'mp3' : 'pdf'));
      finalFileName = `${finalFileName}.${ext}`;
    }

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    // Build the payload manually using Buffer to bypass missing FormData/Blob in older Node.js versions
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${category}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${finalFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    
    const payload = Buffer.concat(parts);
    
    const response = await axios.post(`${BASE_URL}/${getPhoneId()}/media`, payload, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      },
    });

    return response.data.id;
  } catch (err) {
    logger.error('Error uploading media to Meta:', err.response ? err.response.data : err.message);
    throw err;
  }
};

const mediaIdCache = new Map();

/**
 * Downloads HTTP media URL and uploads to Meta to obtain a direct Meta Media ID for instant delivery
 */
const getOrCreateMetaMediaId = async (url, type) => {
  if (mediaIdCache.has(url)) {
    return mediaIdCache.get(url);
  }
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    const buffer = Buffer.from(res.data);
    const headerContentType = res.headers['content-type'] || '';

    let ext = 'jpg';
    let mimeType = 'image/jpeg';

    if (type === 'image') {
      if (headerContentType.includes('png') || url.toLowerCase().includes('.png')) {
        ext = 'png';
        mimeType = 'image/png';
      } else if (headerContentType.includes('webp') || url.toLowerCase().includes('.webp')) {
        ext = 'webp';
        mimeType = 'image/webp';
      } else {
        ext = 'jpg';
        mimeType = 'image/jpeg';
      }
    } else if (type === 'video') {
      ext = 'mp4';
      mimeType = 'video/mp4';
    } else if (type === 'audio') {
      ext = 'mp3';
      mimeType = 'audio/mpeg';
    } else {
      ext = 'pdf';
      mimeType = 'application/pdf';
    }

    const fileName = `media-${Date.now()}.${ext}`;
    const metaMediaId = await uploadMedia(buffer, mimeType, type, fileName);
    if (metaMediaId) {
      mediaIdCache.set(url, metaMediaId);
      logger.info(`[META MEDIA] Pre-uploaded URL to Meta Media ID: ${metaMediaId} (${fileName})`);
      return metaMediaId;
    }
  } catch (err) {
    logger.error(`Error pre-uploading media URL to Meta (${url}):`, err.message);
  }
  return null;
};

/**
 * Sends a media message using a media_id or pre-uploaded URL
 */
const sendMediaMessage = async (to, mediaId, type, caption = '', replyToMessageId = null, senderId = null, mediaBuffer = null, customMimeType = null, quickReplyName = null) => {
  try {
    const recipient = formatForWhatsApp(to);
    let resolvedMediaId = mediaId;
    let isUrl = typeof mediaId === 'string' && mediaId.startsWith('http');

    if (isUrl) {
      const uploadedId = await getOrCreateMetaMediaId(mediaId, type);
      if (uploadedId) {
        resolvedMediaId = uploadedId;
      }
    }

    const isMetaId = !resolvedMediaId.startsWith('http');
    const mediaObj = isMetaId ? { id: resolvedMediaId } : { link: resolvedMediaId };
    if (caption) mediaObj.caption = caption;

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: type, // 'image', 'document', 'video', 'audio'
      [type]: mediaObj,
    };

    if (replyToMessageId) {
      data.context = { message_id: replyToMessageId };
    }

    let response;
    try {
      response = await axios.post(`${BASE_URL}/${getPhoneId()}/messages`, data, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (apiErr) {
      if (isUrl && isMetaId) {
        logger.warn(`Failed to send via Meta Media ID (${resolvedMediaId}), retrying via direct HTTP link...`);
        const fallbackObj = { link: mediaId };
        if (caption) fallbackObj.caption = caption;
        data[type] = fallbackObj;
        response = await axios.post(`${BASE_URL}/${getPhoneId()}/messages`, data, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
        });
      } else {
        throw apiErr;
      }
    }

    const metaMsgId = response.data?.messages?.[0]?.id || null;
    const mimeType = customMimeType || (type === 'image' ? 'image/jpeg' : (type === 'video' ? 'video/mp4' : (type === 'audio' ? 'audio/mpeg' : 'application/pdf')));
    await messageService.logChatMessage(to, 'outgoing', type, caption || '', mediaBuffer || (isUrl ? mediaId : null), mimeType, senderId, metaMsgId, 'sent', null, 0, quickReplyName).catch(err => logger.error('Error logging outgoing bot media message:', err.message));

    return response.data;
  } catch (err) {
    logger.error(`Error sending ${type} message:`, err.response ? err.response.data : err.message);
    throw err;
  }
};

/**
 * Downloads media from Meta's servers
 */
const downloadMedia = async (mediaId) => {
  const token = getToken();
  try {
    // 1. Get media URL from Meta Graph API
    const infoRes = await axios.get(`${BASE_URL}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1'
      },
      timeout: 15000
    });
    const { url, mime_type } = infoRes.data;

    // 2. Download binary data from Meta CDN (try with Auth header, fallback without Auth if CDN redirects)
    let mediaRes;
    try {
      mediaRes = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'curl/7.64.1'
        },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
    } catch (cdnErr) {
      logger.warn(`Meta CDN download retry without auth header for mediaId ${mediaId}:`, cdnErr.message);
      mediaRes = await axios.get(url, {
        headers: {
          'User-Agent': 'curl/7.64.1'
        },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
    }

    return {
      buffer: Buffer.from(mediaRes.data),
      mimeType: mime_type,
    };
  } catch (err) {
    logger.error('Error downloading media from Meta:', err.response ? JSON.stringify(err.response.data) : err.message);
    throw err;
  }
};

/**
 * Sends a Button Message (Max 3 buttons)
 */
const sendButtons = async (to, text, buttons, senderId = null) => {
  try {
    const recipient = formatForWhatsApp(to);
    const sanitizedButtons = (buttons || []).slice(0, 3).map((btn, idx) => {
      let title = (btn.title || '').trim();
      if (title.length > 20) {
        title = title.substring(0, 20).trim();
      }
      if (!title) title = `Option ${idx + 1}`;
      return {
        type: 'reply',
        reply: { id: String(btn.id || `opt-${idx}`), title },
      };
    });

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: text || 'Please select an option:' },
        action: {
          buttons: sanitizedButtons,
        },
      },
    };

    const response = await axios.post(`${BASE_URL}/${getPhoneId()}/messages`, data, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    const metaMsgId = response.data?.messages?.[0]?.id || null;
    const formattedBtnText = `${text}\n\n` + sanitizedButtons.map((b, i) => `${i + 1}. ${b.reply.title}`).join('\n');
    await messageService.logChatMessage(to, 'outgoing', 'interactive', formattedBtnText, null, null, senderId, metaMsgId, 'sent').catch(err => logger.error('Error logging outgoing bot buttons:', err.message));

    return response.data;
  } catch (err) {
    logger.error('Error sending WhatsApp buttons:', err.response ? err.response.data : err.message);
    throw err;
  }
};

/**
 * Sends a List Message (Max 10 rows)
 */
const sendList = async (to, text, buttonLabel, rows, senderId = null) => {
  try {
    const recipient = formatForWhatsApp(to);
    let label = (buttonLabel || 'Select Option').trim();
    if (label.length > 20) label = label.substring(0, 20).trim();
    if (!label) label = 'Select Option';

    const sanitizedRows = (rows || []).slice(0, 10).map((row, idx) => {
      let title = (row.title || '').trim();
      if (title.length > 24) title = title.substring(0, 24).trim();
      if (!title) title = `Option ${idx + 1}`;

      let description = (row.description || '').trim();
      if (description.length > 72) description = description.substring(0, 72).trim();

      const item = { id: String(row.id || `opt-${idx}`), title };
      if (description) item.description = description;
      return item;
    });

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: text || 'Please select an option:' },
        action: {
          button: label,
          sections: [
            {
              title: 'Options',
              rows: sanitizedRows,
            },
          ],
        },
      },
    };

    const response = await axios.post(`${BASE_URL}/${getPhoneId()}/messages`, data, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    const metaMsgId = response.data?.messages?.[0]?.id || null;
    const formattedListText = `${text}\n\n${label}:\n` + sanitizedRows.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
    await messageService.logChatMessage(to, 'outgoing', 'interactive', formattedListText, null, null, senderId, metaMsgId, 'sent').catch(err => logger.error('Error logging outgoing bot list:', err.message));

    return response.data;
  } catch (err) {
    logger.error('Error sending WhatsApp list:', err.response ? err.response.data : err.message);
    throw err;
  }
};

module.exports = {
  sendMessage,
  sendButtons,
  sendList,
  uploadMedia,
  getOrCreateMetaMediaId,
  sendMediaMessage,
  downloadMedia,
};

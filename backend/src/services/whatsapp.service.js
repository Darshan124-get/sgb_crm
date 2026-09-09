const axios = require('axios');
const logger = require('../utils/whatsappLogger');

const { formatForWhatsApp } = require('../utils/phoneUtils');

const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

/**
 * Sends a text message to a WhatsApp recipient
 */
const sendMessage = async (to, text, replyToMessageId = null) => {
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

    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, data, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });

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
const uploadMedia = async (buffer, mimeType, category, fileName = 'file') => {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    // Build the payload manually using Buffer to bypass missing FormData/Blob in older Node.js versions
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${category}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    
    const payload = Buffer.concat(parts);
    
    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/media`, payload, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
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

/**
 * Sends a media message using a media_id
 */
const sendMediaMessage = async (to, mediaId, type, caption = '', replyToMessageId = null) => {
  try {
    const recipient = formatForWhatsApp(to);
    const mediaObj = mediaId.startsWith('http') ? { link: mediaId } : { id: mediaId };
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

    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, data, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });

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
  try {
    // 1. Get media URL
    const infoRes = await axios.get(`${BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${whatsappToken}` },
    });
    const { url, mime_type } = infoRes.data;

    // 2. Download binary data
    const mediaRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${whatsappToken}` },
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return {
      buffer: Buffer.from(mediaRes.data),
      mimeType: mime_type,
    };
  } catch (err) {
    logger.error('Error downloading media from Meta:', err.response ? err.response.data : err.message);
    throw err;
  }
};

/**
 * Sends a Button Message (Max 3 buttons)
 */
const sendButtons = async (to, text, buttons) => {
  try {
    const recipient = formatForWhatsApp(to);
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    };

    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, data, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (err) {
    logger.error('Error sending WhatsApp buttons:', err.response ? err.response.data : err.message);
    throw err;
  }
};

/**
 * Sends a List Message (Max 10 rows)
 */
const sendList = async (to, text, buttonLabel, rows) => {
  try {
    const recipient = formatForWhatsApp(to);
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text },
        action: {
          button: buttonLabel,
          sections: [
            {
              title: 'Options',
              rows: rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || '',
              })),
            },
          ],
        },
      },
    };

    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, data, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });

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
  sendMediaMessage,
  downloadMedia,
};

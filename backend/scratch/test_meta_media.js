const axios = require('axios');
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
require('dotenv').config();

const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

const sendMediaMessage = async (to, mediaId, type, caption = '') => {
  try {
    const mediaObj = mediaId.startsWith('http') ? { link: mediaId } : { id: mediaId };
    if (caption) mediaObj.caption = caption;
    
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: type,
      [type]: mediaObj,
    };

    console.log('Sending payload:', JSON.stringify(data, null, 2));

    const response = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, data, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (err) {
    console.error(`Error sending ${type} message:`, err.response ? JSON.stringify(err.response.data) : err.message);
  }
};

sendMediaMessage('916364594854', 'https://poxjjdfjxidwvrtfjyxx.supabase.co/storage/v1/object/public/SGB/campaigns/TEST5/auto-reply-1784566633189-1.jpeg', 'image');

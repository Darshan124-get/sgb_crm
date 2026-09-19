const axios = require('axios');
const whatsappService = require('../src/services/whatsapp.service');

(async () => {
    const videoUrl = 'https://yvcmjkquuafcgszlkkfu.supabase.co/storage/v1/object/public/SGB/chatbot-media/1789402460533_5dumper.mp4';
    console.log('Testing video URL:', videoUrl);

    try {
        console.time('Download Video');
        const start = Date.now();
        const res = await axios.get(videoUrl, { 
            responseType: 'arraybuffer', 
            timeout: 30000,
            onDownloadProgress: (progressEvent) => {
                console.log(`Downloaded ${progressEvent.loaded} bytes...`);
            }
        });
        console.timeEnd('Download Video');
        console.log(`Video downloaded successfully! Size: ${(res.data.length / (1024 * 1024)).toFixed(2)} MB`);
        console.log('Content-Type:', res.headers['content-type']);
    } catch (err) {
        console.error('Download error:', err.message);
    }

    try {
        console.log('\nTesting getOrCreateMetaMediaId for video URL (10s timeout in whatsapp.service)...');
        console.time('getOrCreateMetaMediaId');
        // Let's call getOrCreateMetaMediaId directly if exported or via sendMediaMessage
        const mediaId = await whatsappService.sendMediaMessage('919590073228', videoUrl, 'video', 'Test video caption', null, -1)
            .catch(e => console.error('sendMediaMessage error:', e.response ? JSON.stringify(e.response.data) : e.message));
        console.timeEnd('getOrCreateMetaMediaId');
    } catch (err) {
        console.error('Error:', err);
    }

    process.exit(0);
})();

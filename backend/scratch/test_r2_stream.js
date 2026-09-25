const express = require('express');
const storageService = require('../src/services/storage.service');

const app = express();

app.get('/test-media/*', async (req, res) => {
  const objectKey = req.params[0];
  console.log('Serving R2 media key:', objectKey);

  try {
    const data = await storageService.downloadObject({ key: objectKey });
    res.setHeader('Content-Type', data.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', data.contentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(data.buffer);
  } catch (err) {
    console.error('Failed to serve R2 object:', err.message);
    res.status(404).send('Media not found');
  }
});

const PORT = 5005;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

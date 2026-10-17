const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const productRoutes = require('./routes/product.routes');
const dealerRoutes = require('./routes/dealer.routes');
const orderRoutes = require('./routes/order.routes');
const logisticsRoutes = require('./routes/logistics.routes');
const reportRoutes = require('./routes/report.routes');
const searchRoutes = require('./routes/search.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const settingsRoutes = require('./routes/settings.routes');
const billingRoutes = require('./routes/billing.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const logRoutes = require('./routes/log.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const webhookRoutes = require('./routes/webhook.routes');
const campaignRoutes = require('./routes/campaign.routes');
const departmentRoutes = require('./routes/department.routes');
const productSetRoutes = require('./routes/product-set.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const telephonyRoutes = require('./routes/telephony.routes');

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Fixes express-rate-limit X-Forwarded-For error)

// Security & Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow external assets
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Global Response Sanitizer Middleware (Mitigates raw SQL / DB Info Leakage)
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        if (body && typeof body === 'object') {
            if (body.error || body.message) {
                let msg = body.error || body.message;
                if (typeof msg === 'string' && (
                    msg.includes('SQL') || 
                    msg.includes('Database') || 
                    msg.includes('connection') || 
                    msg.includes('pool') ||
                    msg.includes('syntax') ||
                    msg.includes('SELECT') ||
                    msg.includes('INSERT') ||
                    msg.includes('UPDATE') ||
                    msg.includes('DELETE') ||
                    msg.includes('Table') ||
                    msg.includes('table') ||
                    msg.includes('Column') ||
                    msg.includes('column') ||
                    msg.includes('foreign key') ||
                    msg.includes('unique key') ||
                    msg.includes('ER_') ||
                    msg.includes('sql')
                )) {
                    if (body.error) body.error = 'Internal database server error';
                    if (body.message) body.message = 'Internal database server error';
                }
            }
            if (body.stack) {
                delete body.stack;
            }
        }
        return originalJson.call(this, body);
    };
    next();
});

// Rate Limiting (General API)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Limit each IP to 10000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files (maxAge 0 for development fresh code fetching)
app.use(express.static(path.join(__dirname, '../../frontend'), {
    maxAge: 0,
    etag: true
}));

// Cloudflare R2 Public Media Streamer Route with 3-tier Fallback (R2 -> Disk -> DB BLOB)
const storageService = require('./services/storage.service');
// On-demand message media streamer (streams binary media from DB BLOB without bloating JSON history payloads)
app.get('/api/media/message/:chatId', async (req, res) => {
    try {
        const chatId = parseInt(req.params.chatId);
        if (isNaN(chatId)) return res.status(400).send('Invalid chat ID');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        const [rows] = await pool.query(
            'SELECT media_data, mime_type, message_type FROM chat_messages WHERE chat_id = ?',
            [chatId]
        );
        if (rows.length === 0 || !rows[0].media_data) {
            return res.status(404).send('Media not found');
        }

        const row = rows[0];
        let buffer = row.media_data;
        let mime = row.mime_type || (row.message_type === 'image' ? 'image/jpeg' : (row.message_type === 'video' ? 'video/mp4' : (row.message_type === 'audio' ? 'audio/mpeg' : 'application/octet-stream')));

        if (typeof buffer === 'string') {
            if (buffer.startsWith('data:')) {
                const parts = buffer.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                if (mimeMatch) mime = mimeMatch[1];
                buffer = Buffer.from(parts[1], 'base64');
            } else {
                buffer = Buffer.from(buffer, 'base64');
            }
        }

        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (err) {
        console.error('Error streaming message media:', err);
        return res.status(500).send('Error streaming media');
    }
});

app.get('/api/media/*', async (req, res) => {
    const objectKey = req.params[0];
    if (!objectKey) return res.status(400).send('Missing media key');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Tier 1: Cloudflare R2
    try {
        const r2Data = await storageService.downloadObject({ key: objectKey });
        if (r2Data && r2Data.buffer) {
            res.setHeader('Content-Type', r2Data.contentType || 'application/octet-stream');
            if (r2Data.contentLength) res.setHeader('Content-Length', r2Data.contentLength);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return res.send(r2Data.buffer);
        }
    } catch (err) {
        // Fallback to local filesystem
    }

    // Tier 2: Local Disk (uploads directory)
    try {
        const localCandidates = [
            path.join(__dirname, '../uploads', objectKey),
            path.join(__dirname, '../../uploads', objectKey),
            path.join(process.cwd(), 'uploads', objectKey),
            path.join(process.cwd(), objectKey),
        ];
        for (const loc of localCandidates) {
            if (fs.existsSync(loc) && fs.statSync(loc).isFile()) {
                const ext = path.extname(loc).toLowerCase();
                let cType = 'application/octet-stream';
                if (['.jpg', '.jpeg'].includes(ext)) cType = 'image/jpeg';
                else if (['.png'].includes(ext)) cType = 'image/png';
                else if (['.webp'].includes(ext)) cType = 'image/webp';
                else if (['.mp4'].includes(ext)) cType = 'video/mp4';
                else if (['.pdf'].includes(ext)) cType = 'application/pdf';
                else if (['.mp3', '.opus', '.ogg', '.m4a'].includes(ext)) cType = 'audio/mpeg';

                res.setHeader('Content-Type', cType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.sendFile(path.resolve(loc));
            }
        }
    } catch (diskErr) {
        // Fallback to DB
    }

    // Tier 3: MySQL chat_messages BLOB/DataURI
    try {
        const cleanName = objectKey.split('/').pop();
        const [rows] = await pool.query(
            `SELECT media_data, mime_type FROM chat_messages 
             WHERE media_url LIKE ? OR media_url LIKE ? OR (media_data IS NOT NULL AND media_name = ?) 
             ORDER BY id DESC LIMIT 1`,
            [`%${objectKey}%`, `%${cleanName}%`, cleanName]
        );
        if (rows.length > 0 && rows[0].media_data) {
            const data = rows[0].media_data;
            const mime = rows[0].mime_type || 'image/jpeg';
            if (typeof data === 'string' && data.startsWith('data:')) {
                const commaIdx = data.indexOf(',');
                const b64 = commaIdx !== -1 ? data.substring(commaIdx + 1) : data;
                const buf = Buffer.from(b64, 'base64');
                res.setHeader('Content-Type', mime);
                return res.send(buf);
            } else if (Buffer.isBuffer(data)) {
                res.setHeader('Content-Type', mime);
                return res.send(data);
            }
        }
    } catch (dbErr) {
        console.warn(`[MEDIA DB FALLBACK ERROR] ${dbErr.message}`);
    }

    console.warn(`[MEDIA 404] Object '${objectKey}' not found in R2, disk, or DB.`);
    return res.status(404).send('Media not found');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/whatsapp/webhook', webhookRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/product-sets', productSetRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/telephony', telephonyRoutes);
app.use('/api/integrations/acefone/webhook', telephonyRoutes);

console.log('✅ WhatsApp API: Mounted at /api/whatsapp');
console.log('✅ WhatsApp Webhook: Mounted at /webhook & /api/whatsapp/webhook');
console.log('✅ Acefone Telephony API: Mounted at /api/telephony');
console.log('✅ Acefone Webhook: Mounted at /api/integrations/acefone/webhook');

// Fallback: API routes that don't exist return 404 JSON (not HTML)
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback: All other routes serve index.html (SPA support) if available
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../../frontend/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Resource not found');
    }
});

module.exports = app;


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

const app = express();

// ─── Auto-Migration: Ensure LONGTEXT for images ───────────────
(async () => {
    const pool = require('./config/db');
    try {
        console.log('Checking database schema for image storage and dealers table...');
        await pool.query('ALTER TABLE products MODIFY COLUMN image_url LONGTEXT');
        await pool.query('ALTER TABLE lead_advance_payments MODIFY COLUMN screenshot_url LONGTEXT');
        
        // Ensure dealers table has new columns
        try { await pool.query('ALTER TABLE dealers ADD COLUMN alternate_number VARCHAR(20) AFTER phone'); } catch(e) {}
        try { await pool.query('ALTER TABLE dealers ADD COLUMN status ENUM("active", "inactive") DEFAULT "active" AFTER state'); } catch(e) {}
        try { await pool.query('ALTER TABLE dealers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at'); } catch(e) {}
        
        // Ensure orders table has notes
        try { await pool.query('ALTER TABLE orders ADD COLUMN notes TEXT AFTER order_status'); } catch(e) {}
        
        console.log('✅ Database schema verified for large image storage and dealers/orders tables.');
    } catch (err) {
        console.warn('⚠️ Auto-migration notice:', err.message);
    }
})();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

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
console.log('✅ Staff Management API: Mounted at /api/users');

// Fallback: API routes that don't exist return 404 JSON (not HTML)
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback: All other routes serve index.html (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

module.exports = app;

-- ============================================================
-- SGB AGRO CRM - Inventory & Product Management Schema
-- ============================================================

-- ─── 1. CATEGORIES ──────────────────────────────────────────
-- Supports hierarchical categories (n-level nesting)
CREATE TABLE IF NOT EXISTS categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT DEFAULT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

-- ─── 2. PRODUCTS ─────────────────────────────────────────────
-- Master table for all products
CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT,
    description TEXT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    unit VARCHAR(20) DEFAULT 'PCS',
    selling_price DECIMAL(12, 2) DEFAULT 0.00,
    dealer_price DECIMAL(12, 2) DEFAULT 0.00,
    min_stock_alert INT DEFAULT 10,
    status ENUM('active', 'inactive') DEFAULT 'active',
    image_url TEXT,
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX (name),
    INDEX (status)
);

-- ─── 3. INVENTORY ────────────────────────────────────────────
-- Real-time stock levels for products
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNIQUE NOT NULL,
    current_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX (current_stock)
);

-- ─── 4. INVENTORY LOGS ───────────────────────────────────────
-- Audit trail for every stock movement
CREATE TABLE IF NOT EXISTS inventory_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    type ENUM('in', 'out', 'adjustment', 'reserved', 'unreserved') NOT NULL,
    quantity INT NOT NULL,
    reference_type VARCHAR(50) COMMENT 'e.g., order, shipment, opening_stock, manual',
    reference_id INT COMMENT 'ID from the reference table if applicable',
    user_id INT COMMENT 'User who performed the action',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX (created_at),
    INDEX (type)
);

-- ─── BOOTSTRAP DATA ──────────────────────────────────────────
-- Optional basic categories
-- INSERT INTO categories (name) VALUES ('Seeds'), ('Fertilizers'), ('Tools'), ('Pesticides');

CREATE DATABASE IF NOT EXISTS u581231108_SGB_CRM_test1;
USE u581231108_SGB_CRM_test1;

-- DROP TABLES IN REVERSE ORDER OF DEPENDENCY
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS packing;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS dealers;
DROP TABLE IF EXISTS lead_advance_payments;
DROP TABLE IF EXISTS lead_interest;
DROP TABLE IF EXISTS lead_followups;
DROP TABLE IF EXISTS lead_notes;
DROP TABLE IF EXISTS lead_messages;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- 1️⃣ USERS & ROLES
CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT,
    language VARCHAR(50) DEFAULT 'EN',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL
);

-- 2️⃣ LEADS (WHATSAPP CORE)
CREATE TABLE leads (
    lead_id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    first_message TEXT,
    language VARCHAR(50),
    customer_name VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    status ENUM('new', 'assigned', 'contacted', 'callback', 'followup', 'interested', 'negotiation', 'advance_paid', 'converted', 'lost', 'not_interested', 'dealer') DEFAULT 'new',
    score ENUM('hot', 'warm', 'cold') DEFAULT 'cold',
    assigned_to INT,
    source VARCHAR(50) DEFAULT 'whatsapp',
    next_followup_date DATETIME NULL,
    reminders_enabled BOOLEAN DEFAULT TRUE,
    lost_reason VARCHAR(255) NULL,
    lost_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE lead_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    message_type ENUM('incoming', 'outgoing') NOT NULL,
    message_text TEXT,
    media_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

CREATE TABLE lead_notes (
    note_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    user_id INT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE lead_followups (
    followup_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    followup_date DATETIME,
    status ENUM('pending', 'done') DEFAULT 'pending',
    remarks TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE lead_interest (
    interest_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    product_id INT,
    crop_type VARCHAR(100),
    quantity_required VARCHAR(100),
    budget DECIMAL(10, 2),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

CREATE TABLE lead_advance_payments (
    advance_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    amount DECIMAL(10, 2),
    payment_mode VARCHAR(50),
    screenshot_url TEXT,
    payment_date DATE,
    verified ENUM('yes', 'no') DEFAULT 'no',
    verified_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 3️⃣ DEALERS
CREATE TABLE dealers (
    dealer_id INT AUTO_INCREMENT PRIMARY KEY,
    dealer_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4️⃣ PRODUCTS & INVENTORY
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT,
    description TEXT,
    sku VARCHAR(50) UNIQUE,
    hsn_code VARCHAR(20),
    unit VARCHAR(20),
    selling_price DECIMAL(10, 2) DEFAULT 0,
    dealer_price DECIMAL(10, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    min_stock_alert INT DEFAULT 10,
    status ENUM('active', 'inactive') DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

ALTER TABLE lead_interest ADD CONSTRAINT fk_lead_interest_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL;

CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNIQUE,
    current_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE inventory_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    type ENUM('in', 'out', 'adjustment') NOT NULL,
    quantity INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 5️⃣ ORDERS
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    order_source ENUM('lead', 'dealer') NOT NULL,
    lead_id INT NULL,
    dealer_id INT NULL,
    customer_name VARCHAR(150),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    order_status ENUM('draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by INT,
    created_by INT,
    billing_done_by INT,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    advance_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL,
    FOREIGN KEY (dealer_id) REFERENCES dealers(dealer_id) ON DELETE SET NULL,
    FOREIGN KEY (locked_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_done_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- 6️⃣ BILLING SYSTEM (GST INVOICE)
CREATE TABLE settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(50) NOT NULL UNIQUE,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    invoice_number VARCHAR(50) UNIQUE,
    invoice_date DATE,
    billing_name VARCHAR(150),
    billing_address TEXT,
    gst_number VARCHAR(20),
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    shipping_charges DECIMAL(10, 2) DEFAULT 0,
    tax_type ENUM('CGST_SGST', 'IGST') DEFAULT 'CGST_SGST',
    cgst DECIMAL(10, 2) DEFAULT 0,
    sgst DECIMAL(10, 2) DEFAULT 0,
    igst DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    invoice_status ENUM('draft', 'finalized', 'cancelled') DEFAULT 'draft',
    is_tax_overridden BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE invoice_items (
    invoice_item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    product_id INT,
    hsn_code VARCHAR(20),
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    gst_percentage DECIMAL(5, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(50),
    payment_type ENUM('advance', 'final', 'partial') DEFAULT 'partial',
    payment_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    proof_url TEXT,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE invoice_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NULL,
    order_id INT NULL,
    action VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 7️⃣ PACKING MODULE
CREATE TABLE packing (
    packing_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    packed_by INT,
    packed_at TIMESTAMP NULL,
    status ENUM('pending', 'packed') DEFAULT 'pending',
    remarks TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (packed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 8️⃣ SHIPPING MODULE
CREATE TABLE shipments (
    shipment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    courier_name VARCHAR(100),
    tracking_id VARCHAR(100),
    shipped_by INT,
    shipped_at TIMESTAMP NULL,
    status ENUM('shipped', 'in_transit', 'delivered') DEFAULT 'shipped',
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (shipped_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 9️⃣ WHATSAPP NOTIFICATIONS
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NULL,
    lead_id INT NULL,
    type VARCHAR(50),
    message TEXT,
    recipient_phone VARCHAR(20),
    status ENUM('sent', 'failed') DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL
);

-- 10️⃣ ADMIN CHAT
CREATE TABLE chat_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    assigned_to INT,
    status ENUM('open', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE chat_messages (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT,
    sender_type ENUM('user', 'admin') NOT NULL,
    message TEXT,
    media_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

-- SEED DATA
INSERT INTO roles (name, description) VALUES 
('admin', 'Full system access'),
('sales', 'Lead management and order creation'),
('billing', 'Invoice generation and payment tracking'),
('packing', 'Order packing module'),
('shipment', 'Shipping and tracking management')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Default Settings
INSERT INTO settings (setting_key, setting_value) VALUES 
('company_name', 'SRI GOWRI BHARGAV PRIVATE LIMITED'),
('company_address', 'LOWERPET, MAIN ROAD KOPPA, Karnataka - 577126, India'),
('company_state', 'Karnataka'),
('company_state_code', '29'),
('company_gst_number', '29ABDCS5673G1ZY'),
('company_contact', '8277009667'),
('company_email', 'sgb.koppa@gmail.com'),
('bank_name', 'State Bank of India 3872'),
('bank_account_no', '39343293872'),
('bank_ifsc', 'Koppa & SBIN0015059'),
('invoice_prefix', 'SGB'),
('default_tax_mode', 'auto'),
('gst_rate', '5')
ON DUPLICATE KEY UPDATE setting_key=setting_key;


-- Insert default admin user: admin /password123
INSERT INTO users (name, phone, email, password_hash, role_id, language, status)
SELECT 'Admin', '0000000000', 'admin@sgbagro.com', '$2a$10$xp5204oZU8a6eHFQFTsMUOJLFBSM3E2lkPO7NVb6PC/fn1PxiC0tK', role_id, 'EN', 'active'
FROM roles WHERE name = 'admin'
ON DUPLICATE KEY UPDATE users.name=users.name;

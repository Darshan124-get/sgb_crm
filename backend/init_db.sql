CREATE DATABASE IF NOT EXISTS u581231108_SGB_CRM_test1;
USE u581231108_SGB_CRM_test1;

-- DROP TABLES IN REVERSE ORDER OF DEPENDENCY
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS user_fcm_tokens;
DROP TABLE IF EXISTS chatbot_audit_logs;
DROP TABLE IF EXISTS chatbot_executions;
DROP TABLE IF EXISTS chatbot_sessions;
DROP TABLE IF EXISTS chatbot_edges;
DROP TABLE IF EXISTS chatbot_nodes;
DROP TABLE IF EXISTS chatbot_flow_versions;
DROP TABLE IF EXISTS chatbot_flows;
DROP TABLE IF EXISTS chatbot_settings;
DROP TABLE IF EXISTS chatbot_media;
DROP TABLE IF EXISTS chatbot_products;
DROP TABLE IF EXISTS chatbot_categories;
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS whatsapp_quick_replies;
DROP TABLE IF EXISTS bot_sessions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS packing;
DROP TABLE IF EXISTS invoice_logs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_set_items;
DROP TABLE IF EXISTS product_sets;
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS dealers;
DROP TABLE IF EXISTS lead_advance_payments;
DROP TABLE IF EXISTS lead_interest;
DROP TABLE IF EXISTS lead_followups;
DROP TABLE IF EXISTS lead_notes;
DROP TABLE IF EXISTS lead_messages;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS departments;
SET FOREIGN_KEY_CHECKS = 1;

-- 1️⃣ DEPARTMENTS, ROLES & USERS
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_code VARCHAR(50) UNIQUE,
    description TEXT,
    manager_id INT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    department_id INT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    default_permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    employee_id VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    department_id INT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    language VARCHAR(10) DEFAULT 'EN',
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE departments ADD CONSTRAINT fk_department_manager FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL;

CREATE TABLE user_fcm_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    fcm_token VARCHAR(255) NOT NULL UNIQUE,
    device_type VARCHAR(50) DEFAULT 'web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2️⃣ LEADS (WHATSAPP CORE)
CREATE TABLE leads (
    lead_id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    first_message TEXT,
    language VARCHAR(50),
    customer_name VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100) NULL,
    state VARCHAR(100),
    pincode VARCHAR(10) NULL,
    delivery_type VARCHAR(50) NULL,
    status ENUM('new', 'assigned', 'contacted', 'callback', 'followup', 'interested', 'negotiation', 'advance_paid', 'converted', 'lost', 'not_interested', 'dealer') DEFAULT 'new',
    score ENUM('hot', 'warm', 'cold') DEFAULT 'cold',
    assigned_to INT,
    source VARCHAR(50) DEFAULT 'whatsapp',
    next_followup_date DATETIME NULL,
    reminders_enabled BOOLEAN DEFAULT TRUE,
    lost_reason VARCHAR(255) NULL,
    lost_notes TEXT NULL,
    decision_engine_state JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    message_type ENUM('incoming', 'outgoing') NOT NULL,
    message_text TEXT,
    media_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lead_notes (
    note_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    user_id INT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4️⃣ PRODUCTS, KITS & INVENTORY
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE lead_interest ADD CONSTRAINT fk_lead_interest_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL;

CREATE TABLE product_sets (
    set_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_set_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    set_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    FOREIGN KEY (set_id) REFERENCES product_sets(set_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNIQUE,
    current_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    type ENUM('in', 'out', 'adjustment') NOT NULL,
    quantity INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INT,
    created_by INT NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5️⃣ ORDERS
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    order_source ENUM('lead', 'dealer') NOT NULL,
    lead_id INT NULL,
    dealer_id INT NULL,
    customer_name VARCHAR(150),
    phone VARCHAR(20),
    address TEXT,
    village VARCHAR(100) NULL,
    district VARCHAR(100) NULL,
    pincode VARCHAR(10) NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    delivery_type VARCHAR(50) NULL,
    order_status ENUM('draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by INT,
    created_by INT,
    billing_done_by INT,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    advance_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    extra_charges DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL,
    FOREIGN KEY (dealer_id) REFERENCES dealers(dealer_id) ON DELETE SET NULL,
    FOREIGN KEY (locked_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_done_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6️⃣ BILLING SYSTEM (GST INVOICE)
CREATE TABLE settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(50) NOT NULL UNIQUE,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    invoice_number VARCHAR(50) UNIQUE,
    invoice_date DATE,
    billing_name VARCHAR(150),
    billing_phone VARCHAR(20) NULL,
    billing_address TEXT,
    billing_pincode VARCHAR(10) NULL,
    gst_number VARCHAR(20),
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    shipping_charges DECIMAL(10, 2) DEFAULT 0,
    extra_charges DECIMAL(10, 2) DEFAULT 0,
    tax_type ENUM('CGST_SGST', 'IGST', 'NONE') DEFAULT 'NONE',
    cgst DECIMAL(10, 2) DEFAULT 0,
    sgst DECIMAL(10, 2) DEFAULT 0,
    igst DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    invoice_status ENUM('draft', 'finalized', 'cancelled') DEFAULT 'draft',
    is_tax_overridden BOOLEAN DEFAULT FALSE,
    delivery_note TEXT NULL,
    dispatch_through VARCHAR(100) NULL,
    destination VARCHAR(100) NULL,
    payment_terms TEXT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7️⃣ PACKING MODULE
CREATE TABLE packing (
    packing_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT NULL,
    unit_no INT DEFAULT 1,
    packed_by INT,
    packed_at TIMESTAMP NULL,
    status ENUM('pending', 'packed') DEFAULT 'pending',
    remarks TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (packed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8️⃣ SHIPPING MODULE
CREATE TABLE shipments (
    shipment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT NULL,
    unit_no INT DEFAULT 1,
    courier_name VARCHAR(100),
    tracking_id VARCHAR(100),
    shipped_by INT,
    shipped_at TIMESTAMP NULL,
    delivery_date DATE NULL,
    check_received_date DATE NULL,
    status ENUM('shipped', 'in_transit', 'delivered') DEFAULT 'shipped',
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (shipped_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9️⃣ WHATSAPP NOTIFICATIONS & CAMPAIGNS
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id VARCHAR(100) NOT NULL UNIQUE,
    tag_line TEXT NOT NULL,
    status ENUM('active', 'deactive') DEFAULT 'active',
    ad_spend DECIMAL(10, 2) DEFAULT 0.00,
    auto_replies JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10️⃣ CHAT & LOGGING
CREATE TABLE chat_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    assigned_to INT,
    status ENUM('open', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT,
    sender_type ENUM('user', 'admin') NOT NULL,
    sender_id INT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    message TEXT,
    media_data LONGBLOB,
    media_url TEXT,
    mime_type VARCHAR(100),
    message_id VARCHAR(255) NULL,
    status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
    reaction VARCHAR(50) DEFAULT NULL,
    reply_to_chat_id INT DEFAULT NULL,
    is_forwarded TINYINT(1) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bot_sessions (
    phone VARCHAR(20) PRIMARY KEY,
    current_state VARCHAR(100) DEFAULT 'START',
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE whatsapp_quick_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shortcut VARCHAR(50) NOT NULL UNIQUE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(100) NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11️⃣ CHATBOT SYSTEM TABLES & MEDIA
CREATE TABLE chatbot_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) DEFAULT 'fa-layer-group',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('active', 'draft') DEFAULT 'active',
    used_in_flows_count INT DEFAULT 0,
    description TEXT,
    image_url TEXT,
    gallery_urls JSON,
    specs JSON,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type ENUM('image', 'video', 'document', 'audio', 'gif', 'other') NOT NULL DEFAULT 'image',
    mime_type VARCHAR(100),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_path VARCHAR(255),
    associated_product_id INT NULL,
    used_in_flows_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (associated_product_id) REFERENCES chatbot_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_flows (
    flow_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'enquiry',
    status ENUM('draft', 'active', 'paused', 'archived') DEFAULT 'draft',
    active_version_id INT DEFAULT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_flow_versions (
    version_id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    version_number DECIMAL(4,2) NOT NULL,
    status ENUM('draft', 'published') DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    published_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version_id INT NOT NULL,
    node_key VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    position_x INT DEFAULT 0,
    position_y INT DEFAULT 0,
    config JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_edges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version_id INT NOT NULL,
    source_node_key VARCHAR(100) NOT NULL,
    target_node_key VARCHAR(100) NOT NULL,
    source_handle VARCHAR(150) DEFAULT NULL,
    target_handle VARCHAR(150) DEFAULT NULL,
    condition_key VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    version_id INT NOT NULL,
    lead_id INT DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    current_node_key VARCHAR(100) DEFAULT 'node-start',
    status ENUM('active', 'paused_for_human', 'completed', 'expired') DEFAULT 'active',
    variables JSON DEFAULT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    paused_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    node_key VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    input TEXT,
    output TEXT,
    status VARCHAR(50) DEFAULT 'success',
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ai_fallback_enabled BOOLEAN DEFAULT TRUE,
    ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
    ai_temperature DECIMAL(2,1) DEFAULT 0.3,
    default_fallback_msg TEXT NOT NULL,
    max_fallback_attempts INT DEFAULT 2,
    webhook_url VARCHAR(255) DEFAULT NULL,
    webhook_token VARCHAR(255) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chatbot_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    version_id INT DEFAULT NULL,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12️⃣ SEED DATA

-- Insert default departments
INSERT INTO departments (id, name, department_code, description, status) VALUES 
(1, 'Sales Department', 'SALES', 'Handles leads, customer inquiries, and sales deals', 'active'),
(2, 'Billing Department', 'BILLING', 'Manages invoicing, GST compliance, and payment verification', 'active'),
(3, 'Packing Department', 'PACKING', 'Handles product packaging and order preparation', 'active'),
(4, 'Shipping Department', 'SHIPPING', 'Manages courier dispatch, tracking, and logistics delivery', 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Insert default roles
INSERT INTO roles (role_id, name, description, department_id) VALUES 
(1, 'super-admin', 'Master system access', NULL),
(2, 'admin', 'Full system access', NULL),
(3, 'manager', 'Department head with full access to department panels', NULL),
(4, 'executive', 'Standard worker in assigned department', NULL),
(5, 'viewer', 'Read-only access to department panels', NULL)
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

-- Default Quick Replies
INSERT IGNORE INTO whatsapp_quick_replies (shortcut, message) VALUES 
('thanks', 'Thank you for your business! We look forward to working with you again.'),
('questions', 'Hello sir\nHow are you');

-- Insert default admin user: admin@sgbagro.com / password123
INSERT INTO users (name, phone, email, password_hash, role_id, department_id, language, status)
SELECT 'Admin', '0000000000', 'admin@sgbagro.com', '$2a$10$xp5204oZU8a6eHFQFTsMUOJLFBSM3E2lkPO7NVb6PC/fn1PxiC0tK', role_id, NULL, 'EN', 'active'
FROM roles WHERE name = 'admin'
ON DUPLICATE KEY UPDATE users.name=users.name;

-- Seed default chatbot settings
INSERT INTO chatbot_settings (id, default_fallback_msg, webhook_url) VALUES 
(1, 'I\'m sorry, I didn\'t quite catch that. Would you like to connect with a sales representative?', 'https://api.sgbagro.com/v1/webhooks/whatsapp')
ON DUPLICATE KEY UPDATE default_fallback_msg=VALUES(default_fallback_msg);

-- Seed Chatbot Categories
INSERT IGNORE INTO chatbot_categories (id, name, icon) VALUES
(1, 'Full Set Machines', 'fa-layer-group'),
(2, 'Trolley', 'fa-truck-ramp-box'),
(3, 'Dumper', 'fa-truck-monster'),
(4, 'Tractor', 'fa-tractor'),
(5, 'Brush Cutter', 'fa-scissors'),
(6, 'Power Sprayer', 'fa-spray-can'),
(7, 'Attachments', 'fa-plug'),
(8, 'Accessories', 'fa-boxes-packing');

-- Seed Chatbot Products
INSERT INTO chatbot_products (id, name, sku, category, price, status, used_in_flows_count, description, image_url, gallery_urls, specs, tags) VALUES
(1, 'Machine 12K', 'FSM-12K', 'Full Set Machines', 12000.00, 'active', 3, 'High performance 12K power tiller suitable for small and medium farms.', '../../assets/images/red_power_tiller.jpg', '["../../assets/images/red_power_tiller.jpg", "../../assets/images/mini_tractor.jpg"]', '[{"key": "Engine Power", "val": "12 HP"}, {"key": "Fuel Type", "val": "Diesel"}]', '["full set", "power tiller", "12k"]'),
(2, 'Machine 16K', 'FSM-16K', 'Full Set Machines', 16000.00, 'active', 2, 'Heavy-duty 16 HP power tiller with double electric starter.', '../../assets/images/mini_tractor.jpg', '["../../assets/images/mini_tractor.jpg"]', '[{"key": "Engine Power", "val": "16 HP"}]', '["full set", "16k"]'),
(3, 'Machine 21K', 'FSM-21K', 'Full Set Machines', 21000.00, 'draft', 0, 'Ultimate 21 HP Power Tiller designed for large commercial farms.', '../../assets/images/red_power_tiller.jpg', '["../../assets/images/red_power_tiller.jpg"]', '[{"key": "Engine Power", "val": "21 HP"}]', '["full set", "21k"]'),
(4, 'Back Pack 1', 'BP-01', 'Attachments', 4500.00, 'active', 5, 'Backpack attachment pack with ergonomic harness.', '../../assets/images/red_power_tiller.jpg', '["../../assets/images/red_power_tiller.jpg"]', '[{"key": "Harness", "val": "Padded"}]', '["back pack", "attachment"]'),
(5, 'Back Pack 2', 'BP-02', 'Attachments', 5800.00, 'active', 1, 'Advanced backpack multi-cutter attachment.', '../../assets/images/mini_tractor.jpg', '["../../assets/images/mini_tractor.jpg"]', '[{"key": "Weight", "val": "18 kg"}]', '["backpack", "attachment"]')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Chatbot Media
INSERT INTO chatbot_media (id, filename, original_name, file_url, file_type, mime_type, size_bytes, storage_path) VALUES
(1, 'red_power_tiller.jpg', 'Red Power Tiller.jpg', '../../assets/images/red_power_tiller.jpg', 'image', 'image/jpeg', 450000, 'chatbot-media/red_power_tiller.jpg'),
(2, 'mini_tractor.jpg', 'Mini Tractor 18HP.jpg', '../../assets/images/mini_tractor.jpg', 'image', 'image/jpeg', 620000, 'chatbot-media/mini_tractor.jpg')
ON DUPLICATE KEY UPDATE filename=VALUES(filename);

-- Seed default Flow: Full Set / Trolley Enquiry
INSERT INTO chatbot_flows (flow_id, name, description, category, status, active_version_id) 
VALUES (1, 'Full Set / Trolley Enquiry', 'WhatsApp flow to qualify machinery inquiries.', 'enquiry', 'active', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO chatbot_flow_versions (version_id, flow_id, version_number, status, published_at) 
VALUES (1, 1, 1.0, 'published', NOW())
ON DUPLICATE KEY UPDATE version_number=VALUES(version_number);

INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES 
(1, 'node-start', 'start', 'Start', 80, 250, '{"triggerType": "Keyword", "keywords": "trolley, full set, machine"}'),
(1, 'node-1', 'question', 'Step 1', 280, 250, '{"question": "Q: Sir do you need a full set or Trolley ?", "responseType": "buttons", "choices": ["Full Set", "Trolley"], "saveResponseTo": "product_interest", "options": [{"label": "Full Set", "value": "full_set", "nextNode": "node-2"}, {"label": "Trolley", "value": "trolley", "nextNode": "node-3"}]}'),
(1, 'node-2', 'question', 'Step 2', 520, 100, '{"question": "Q: How much Acre land do you have sir ?\\n(Sir nimm jaaga estu ide ant gottu adra, navu machine suggest madtivi sir)", "responseType": "buttons", "choices": ["1. Below 2 Acre", "2. 2 - 5 Acre", "3. More than 5 Acre"], "saveResponseTo": "land_acres", "options": [{"label": "1. Below 2 Acre", "value": "below_2_acre", "nextNode": "node-4"}, {"label": "2. 2 - 5 Acre", "value": "2_5_acre", "nextNode": "node-5"}, {"label": "3. More than 5 Acre", "value": "more_5_acre", "nextNode": "node-6"}]}'),
(1, 'node-3', 'question', 'Step: Brush Cutter', 520, 440, '{"question": "Q: Which brush cutter do you have sir?", "responseType": "buttons", "choices": ["1. Side pack 1", "2. Side pack 2", "3. Don\'t know"], "saveResponseTo": "brush_cutter_type", "options": [{"label": "1. Side pack 1", "value": "side_pack_1", "nextNode": "node-7"}, {"label": "2. Side pack 2", "value": "side_pack_2", "nextNode": "node-8"}, {"label": "3. Don\'t know", "value": "dont_know", "nextNode": "node-9"}]}'),
(1, 'node-4', 'product', 'Send details of Machine 12K', 780, 40, '{"productId": 1, "product": "Machine 12K", "message": "Send details of Machine 12K", "nextNode": "node-10"}'),
(1, 'node-5', 'product', 'Send details of Machine 16K & 21K', 780, 160, '{"productId": 2, "product": "Machine 16K & 21K", "message": "Send details of Machine 16K & 21K", "nextNode": "node-10"}'),
(1, 'node-6', 'product', 'Send details of Machine 21K', 780, 280, '{"productId": 3, "product": "Machine 21K", "message": "Send details of Machine 21K", "nextNode": "node-10"}'),
(1, 'node-7', 'product', 'Send details of Side Pack 1', 780, 400, '{"productId": 4, "product": "Side Pack 1", "message": "Send details of Side Pack 1", "nextNode": "node-10"}'),
(1, 'node-8', 'product', 'Send details of Side Pack 2', 780, 520, '{"productId": 5, "product": "Side Pack 2", "message": "Send details of Side Pack 2", "nextNode": "node-10"}'),
(1, 'node-9', 'message', 'Reply Message: Photo Request', 780, 640, '{"message": "Reply Message:\\nSir please send photo of your brush cutter", "inputType": "image", "nextNode": "node-10"}'),
(1, 'node-10', 'question', 'Step 3', 1050, 280, '{"question": "Q: Right time to contact you ?\\n(sir nimage call madalu sariyada samaya?)", "responseType": "buttons", "choices": ["1. 9:30 - 1:00 PM", "2. 2:30 - 6:00 PM"], "saveResponseTo": "preferred_contact_time", "options": [{"label": "1. 9:30 - 1:00 PM", "value": "morning", "nextNode": "node-11"}, {"label": "2. 2:30 - 6:00 PM", "value": "evening", "nextNode": "node-11"}]}'),
(1, 'node-11', 'text_input', 'Step 4', 1300, 280, '{"question": "Q: Please share your Name & Place\\n(Sir nimm hesaru mattu ooru tillisi)", "choices": ["Name & Place"], "saveResponseTo": "name_place", "options": [{"label": "Name & Place", "value": "name_place", "nextNode": "node-12"}], "nextNode": "node-12"}'),
(1, 'node-12', 'create_lead', 'Create Lead', 1480, 280, '{"nextNode": "node-13"}'),
(1, 'node-13', 'end', 'End', 1640, 280, '{"message": "Thank You!\\nOur team will contact you soon."}');

INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES 
(1, 'node-start', 'node-1', NULL, NULL),
(1, 'node-1', 'node-2', 'Full Set', NULL),
(1, 'node-1', 'node-3', 'Trolley', NULL),
(1, 'node-2', 'node-4', '1. Below 2 Acre', NULL),
(1, 'node-2', 'node-5', '2. 2 - 5 Acre', NULL),
(1, 'node-2', 'node-6', '3. More than 5 Acre', NULL),
(1, 'node-3', 'node-7', '1. Side pack 1', NULL),
(1, 'node-3', 'node-8', '2. Side pack 2', NULL),
(1, 'node-3', 'node-9', '3. Don\'t know', NULL),
(1, 'node-4', 'node-10', NULL, NULL),
(1, 'node-5', 'node-10', NULL, NULL),
(1, 'node-6', 'node-10', NULL, NULL),
(1, 'node-7', 'node-10', NULL, NULL),
(1, 'node-8', 'node-10', NULL, NULL),
(1, 'node-9', 'node-10', NULL, NULL),
(1, 'node-10', 'node-11', '1. 9:30 - 1:00 PM', NULL),
(1, 'node-10', 'node-11', '2. 2:30 - 6:00 PM', NULL),
(1, 'node-11', 'node-12', NULL, NULL),
(1, 'node-12', 'node-13', NULL, NULL);

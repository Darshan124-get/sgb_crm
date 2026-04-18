-- Dealer Module SQL Schema
-- Use this to initialize or update the dealers table for SGB Agro CRM

-- 1. Create table if not exists (with all new fields)
CREATE TABLE IF NOT EXISTS dealers (
    dealer_id INT AUTO_INCREMENT PRIMARY KEY,
    dealer_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    alternate_number VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Migration: Use these if your table already exists but lacks the new fields
/*
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS alternate_number VARCHAR(20) AFTER phone;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') DEFAULT 'active' AFTER state;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
*/

-- 3. Sample Seed Data (For Testing)
INSERT INTO dealers (dealer_name, contact_person, phone, alternate_number, email, address, city, state, status) 
VALUES 
('Bharat Agro Agencies', 'Rajesh Kumar', '9876543210', '9876543211', 'bharat_agro@example.com', '123, Mandi Road', 'Solan', 'Himachal Pradesh', 'active'),
('Green Earth Fertilizers', 'Sanjay Singh', '9123456780', NULL, 'greenearth@example.com', 'Plot 45, Industrial Area', 'Karnal', 'Haryana', 'active'),
('Kisan Mitra Stores', 'Amit Patel', '9000111222', '9000111333', 'kisanmitra@example.com', 'Shop 12, Main Market', 'Nashik', 'Maharashtra', 'inactive');

-- 4. Useful Queries for Dealer Module

-- Fetch all dealers (Admin view)
-- SELECT * FROM dealers ORDER BY created_at DESC;

-- Get Dealer Stats for Details Page
-- SELECT 
--     COUNT(*) as total_orders,
--     SUM(total_amount) as total_business,
--     SUM(balance_amount) as total_balance
-- FROM orders 
-- WHERE dealer_id = [ID] AND order_status != 'cancelled';

-- Soft delete / Deactivate
-- UPDATE dealers SET status = 'inactive' WHERE dealer_id = [ID];

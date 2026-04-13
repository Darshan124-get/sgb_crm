-- SGB Agro: Final Structural Database Seeding
-- Matches schema in init_db.sql exactly

-- Cleanup existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE lead_followups;
TRUNCATE TABLE orders;
TRUNCATE TABLE leads;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. SEED LEADS (22 Total)
INSERT INTO leads (lead_id, customer_name, phone_number, first_message, source, status, city, state, created_at) VALUES 
(1, 'Manjunath Gowda', '9845012345', 'Hi, I need organic fertilizer for my farm.', 'whatsapp', 'new', 'Hubli', 'Karnataka', NOW()),
(2, 'Shiva Kumar', '9845023456', 'Interested in NPK packs seen on FB.', 'Facebook Ads', 'new', 'Dharwad', 'Karnataka', NOW()),
(3, 'Basavaraj P', '9845034567', 'Reference from Mr. Hegde.', 'Reference', 'new', 'Belgaum', 'Karnataka', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(4, 'Suresh Halli', '9845045678', 'Manual lead from agri-fair.', 'manual', 'new', 'Koppal', 'Karnataka', DATE_SUB(NOW(), INTERVAL 5 HOUR)),

(5, 'Amit Kumar', '9845056789', 'Need bulk pricing for 50 acres.', 'whatsapp', 'interested', 'Gulbarga', 'Karnataka', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(6, 'Deepak S', '9845067890', 'Inquiry via Google search.', 'Google Ads', 'interested', 'Yadgir', 'Karnataka', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(7, 'Naveen Reddy', '9845078901', 'Looking for soil booster trial pack.', 'Reference', 'interested', 'Raichur', 'Karnataka', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(8, 'Prashanth B', '9845089012', 'Interested in dealer opportunities.', 'Facebook Ads', 'followup', 'Bagalkot', 'Karnataka', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(9, 'Raghavendra H', '9845090123', 'Hi, where is your Hubli branch?', 'whatsapp', 'followup', 'Vijayapura', 'Karnataka', DATE_SUB(NOW(), INTERVAL 5 DAY)),

(10, 'Mallikarjun J', '9845011223', 'Met at Koppal expo.', 'manual', 'followup', 'Haveri', 'Karnataka', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(11, 'Gurushanth S', '9845022334', 'Price list required for micronutrients.', 'whatsapp', 'followup', 'Davangere', 'Karnataka', DATE_SUB(NOW(), INTERVAL 7 DAY)),

(12, 'Paramesh G', '9845033445', 'Seed treatment products inquiry.', 'whatsapp', 'converted', 'Shimoga', 'Karnataka', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(13, 'Lingaraja K', '9845044556', 'Friend recommended SGB Agro.', 'Reference', 'converted', 'Chitradurga', 'Karnataka', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(14, 'Somanna B', '9845055667', 'Hi, please send catalog.', 'whatsapp', 'converted', 'Tumkur', 'Karnataka', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(15, 'Kenchaiah M', '9845066778', 'Facebook ad inquiry.', 'Facebook Ads', 'converted', 'Kolar', 'Karnataka', DATE_SUB(NOW(), INTERVAL 11 DAY)),
(16, 'Rangappa D', '9845077889', 'Google search result click.', 'Google Ads', 'converted', 'Chikballapur', 'Karnataka', DATE_SUB(NOW(), INTERVAL 12 DAY)),

(17, 'Ananth Rao', '9845088990', 'Reference inquiry.', 'Reference', 'lost', 'Bangalore', 'Karnataka', DATE_SUB(NOW(), INTERVAL 13 DAY)),
(18, 'Sidramayya H', '9845099001', 'WhatsApp greeting only.', 'whatsapp', 'lost', 'Mysore', 'Karnataka', DATE_SUB(NOW(), INTERVAL 14 DAY)),
(19, 'Bhairappa S', '9845011111', 'Competitor price comparison.', 'manual', 'lost', 'Mandya', 'Karnataka', DATE_SUB(NOW(), INTERVAL 15 DAY)),

(20, 'Venkatesh L', '9845022222', 'Price of Fert-01?', 'whatsapp', 'new', 'Hassan', 'Karnataka', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(21, 'Shashikala V', '9845033333', 'Agri-input requirement.', 'Google Ads', 'followup', 'Mangalore', 'Karnataka', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(22, 'Ramesh J', '9845044444', 'Bulk order inquiry.', 'Reference', 'converted', 'Udupi', 'Karnataka', DATE_SUB(NOW(), INTERVAL 20 DAY));

-- 2. SEED ORDERS (12 Total)
-- Columns: order_id, order_source, lead_id, customer_name, total_amount, order_status, created_at
INSERT INTO orders (order_id, order_source, lead_id, customer_name, total_amount, order_status, created_at) VALUES 
(1, 'lead', 12, 'Paramesh G', 24500.00, 'delivered', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(2, 'lead', 13, 'Lingaraja K', 18200.00, 'shipped', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(3, 'lead', 14, 'Somanna B', 45000.00, 'billed', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(4, 'lead', 15, 'Kenchaiah M', 12500.00, 'delivered', DATE_SUB(NOW(), INTERVAL 11 DAY)),
(5, 'lead', 16, 'Rangappa D', 22000.00, 'delivered', DATE_SUB(NOW(), INTERVAL 12 DAY)),
(6, 'lead', 22, 'Ramesh J', 55000.00, 'delivered', DATE_SUB(NOW(), INTERVAL 20 DAY)),
(7, 'lead', 10, 'Mallikarjun J', 32000.00, 'draft', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(8, 'lead', 11, 'Gurushanth S', 28000.00, 'draft', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(9, 'lead', 12, 'Paramesh G', 15000.00, 'shipped', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(10, 'lead', 13, 'Lingaraja K', 9800.00, 'shipped', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(11, 'lead', 14, 'Somanna B', 12500.00, 'delivered', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(12, 'lead', 15, 'Kenchaiah M', 10000.00, 'delivered', DATE_SUB(NOW(), INTERVAL 7 DAY));

-- 3. SEED FOLLOW-UPS
INSERT INTO lead_followups (lead_id, followup_date, status, remarks, created_at) VALUES 
(5, NOW(), 'pending', 'Confirm order quantity for Organic Fertilizer', NOW()),
(6, DATE_ADD(NOW(), INTERVAL 2 HOUR), 'pending', 'Call back regarding payment terms', NOW()),
(7, DATE_ADD(NOW(), INTERVAL 4 HOUR), 'pending', 'Follow up on sample pack quality', NOW()),
(8, DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending', 'Send brochure for Soil Booster', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(10, NOW(), 'pending', 'NEGOTIATION STALLED - Immediate call required!', DATE_SUB(NOW(), INTERVAL 2 DAY));

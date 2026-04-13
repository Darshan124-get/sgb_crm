-- Seed Roles for SGB Agro CRM
USE admin_db;

INSERT INTO roles (name, description) VALUES 
('Super-Admin', 'Full system access and user management'),
('Sales', 'Lead management and sales pipeline operations'),
('Billing', 'Finance, invoicing, and payment tracking'),
('Packaging', 'Order preparation and packaging status management'),
('Shipment', 'Logistics coordination and shipping tracking')
ON DUPLICATE KEY UPDATE description = VALUES(description);

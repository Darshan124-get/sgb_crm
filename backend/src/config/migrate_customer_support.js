const db = require('../config/db');

async function migrate() {
    try {
        console.log('--- Starting Customer Support Migration ---');

        // 1. Add purchase_source to orders
        try {
            await db.query("ALTER TABLE orders ADD COLUMN purchase_source VARCHAR(50) DEFAULT 'SGB Direct'");
            console.log("Added 'purchase_source' column to orders.");
        } catch (e) {
            if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
                console.warn("purchase_source notice:", e.message);
            }
        }

        // Set default for lead orders
        await db.query("UPDATE orders SET purchase_source = 'SGB Direct' WHERE order_source = 'lead' AND (purchase_source IS NULL OR purchase_source = '')");

        // 2. Add in-app notification columns to notifications table
        const notifCols = [
            "ALTER TABLE notifications ADD COLUMN user_id INT NULL",
            "ALTER TABLE notifications ADD COLUMN title VARCHAR(255) NULL",
            "ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0",
            "ALTER TABLE notifications ADD COLUMN link VARCHAR(255) NULL",
            "ALTER TABLE notifications ADD COLUMN data JSON NULL",
            "ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ];
        for (const sql of notifCols) {
            try {
                await db.query(sql);
            } catch (e) {
                // Column might already exist
            }
        }
        console.log("Verified 'notifications' table columns.");

        // 3. customer_support_cases table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_cases (
                case_id INT AUTO_INCREMENT PRIMARY KEY,
                case_number VARCHAR(50) UNIQUE NOT NULL,
                order_id INT NULL UNIQUE,
                manual_order_number VARCHAR(100) NULL,
                lead_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                customer_phone VARCHAR(50) NOT NULL,
                product_summary TEXT NULL,
                assigned_to INT NULL,
                status ENUM('delivered', 'pending_contact', 'contacted', 'guidance_in_progress', 'completed', 'cancelled') DEFAULT 'delivered',
                delivery_date DATETIME NULL,
                initial_call_date DATETIME NULL,
                installation_status VARCHAR(50) NULL,
                completed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_order_id (order_id),
                INDEX idx_assigned_to (assigned_to),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_cases' ready.");

        // 4. customer_support_calls table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_calls (
                call_id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                call_type ENUM('INITIAL', 'FOLLOW_UP') NOT NULL DEFAULT 'INITIAL',
                call_outcome ENUM('answered', 'not_answered', 'callback_required', 'no_assistance_needed') NOT NULL,
                installation_status ENUM('successfully_installed', 'in_progress', 'needs_more_guidance', 'technician_required', 'not_applicable') NULL,
                guidance_provided TEXT NULL,
                installation_instructions TEXT NULL,
                product_usage_guidance TEXT NULL,
                customer_questions TEXT NULL,
                reported_problems TEXT NULL,
                feedback TEXT NULL,
                remarks TEXT NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_case_id (case_id),
                INDEX idx_call_type (call_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_calls' ready.");

        // 5. customer_support_photos table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_photos (
                photo_id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                call_id INT NULL,
                file_url VARCHAR(500) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_size INT NULL,
                uploaded_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_case_id (case_id),
                INDEX idx_call_id (call_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_photos' ready.");

        // 6. customer_support_notes table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_notes (
                note_id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                call_id INT NULL,
                note TEXT NOT NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_case_id (case_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_notes' ready.");

        // 7. customer_support_followups table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_followups (
                followup_id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                order_id INT NULL,
                customer_name VARCHAR(150) NULL,
                customer_phone VARCHAR(50) NULL,
                assigned_to INT NULL,
                followup_type VARCHAR(50) NOT NULL DEFAULT '30_DAY_PRODUCT_CHECK',
                scheduled_date DATE NOT NULL,
                status ENUM('UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED') DEFAULT 'UPCOMING',
                product_condition ENUM('working_fine', 'minor_issue', 'major_issue', 'not_using') NULL,
                any_issues ENUM('yes', 'no') NULL,
                customer_feedback TEXT NULL,
                issue_description TEXT NULL,
                next_action ENUM('no_action_required', 'followup_again', 'technician_required', 'service_required', 'replacement_required') NULL,
                remarks TEXT NULL,
                notification_sent TINYINT(1) DEFAULT 0,
                completed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_case_followup (case_id, followup_type),
                INDEX idx_scheduled_date (scheduled_date),
                INDEX idx_status (status),
                INDEX idx_assigned_to (assigned_to)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_followups' ready.");

        console.log('✅ Customer Support Migration Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

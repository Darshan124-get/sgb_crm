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
                call_outcome ENUM('answered', 'not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required', 'no_assistance_needed') NOT NULL,
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

        // 8. customer_support_job_cards table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_job_cards (
                job_card_id INT AUTO_INCREMENT PRIMARY KEY,
                job_card_number VARCHAR(50) UNIQUE NOT NULL,
                case_id INT NULL,
                order_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                customer_phone VARCHAR(50) NOT NULL,
                customer_address TEXT NULL,
                product_summary TEXT NULL,
                job_type ENUM('Installation', 'Service/Repair', 'Inspection', 'Replacement Assessment', 'Other') NOT NULL DEFAULT 'Service/Repair',
                priority ENUM('Low', 'Medium', 'High', 'Urgent') NOT NULL DEFAULT 'Medium',
                status ENUM('Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Open',
                issue_description TEXT NULL,
                work_required TEXT NULL,
                assigned_to INT NULL,
                due_date DATE NULL,
                notes TEXT NULL,
                diagnosis TEXT NULL,
                work_performed TEXT NULL,
                service_cost DECIMAL(10,2) DEFAULT 0.00,
                cancellation_reason TEXT NULL,
                completed_at DATETIME NULL,
                cancelled_at DATETIME NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_case_id (case_id),
                INDEX idx_order_id (order_id),
                INDEX idx_status (status),
                INDEX idx_assigned_to (assigned_to),
                INDEX idx_due_date (due_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_job_cards' ready.");

        // 9. customer_support_job_card_parts table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_job_card_parts (
                part_id INT AUTO_INCREMENT PRIMARY KEY,
                job_card_id INT NOT NULL,
                part_name VARCHAR(255) NOT NULL,
                part_number VARCHAR(100) NULL,
                quantity INT NOT NULL DEFAULT 1,
                unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                remarks VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_job_card_id (job_card_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_job_card_parts' ready.");

        // 10. customer_support_job_card_photos table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_job_card_photos (
                photo_id INT AUTO_INCREMENT PRIMARY KEY,
                job_card_id INT NOT NULL,
                photo_type ENUM('issue', 'before', 'after', 'other') NOT NULL DEFAULT 'issue',
                file_url VARCHAR(500) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_size INT NULL,
                uploaded_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_job_card_id (job_card_id),
                INDEX idx_photo_type (photo_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_job_card_photos' ready.");

        // 11. customer_support_job_card_logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_job_card_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                job_card_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                previous_status VARCHAR(50) NULL,
                new_status VARCHAR(50) NULL,
                notes TEXT NULL,
                performed_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_job_card_id (job_card_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_job_card_logs' ready.");

        // 12. Enhance Job Card tables for SGB Agro Physical Job Card Workflow (Non-destructive)
        await db.query(`
            ALTER TABLE customer_support_job_cards
            MODIFY COLUMN status ENUM('Draft', 'Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Open'
        `);
        await db.query(`
            ALTER TABLE customer_support_job_cards
            MODIFY COLUMN customer_name VARCHAR(150) NOT NULL DEFAULT ''
        `);
        await db.query(`
            ALTER TABLE customer_support_job_cards
            MODIFY COLUMN customer_phone VARCHAR(50) NOT NULL DEFAULT ''
        `);

        const jobCardExtraCols = [
            "ALTER TABLE customer_support_job_cards ADD COLUMN job_card_date DATE NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN technician_name VARCHAR(150) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN machine_make_model VARCHAR(255) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN serial_vin_number VARCHAR(150) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN hours_run VARCHAR(50) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN specific_complaint VARCHAR(255) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN original_issue_description TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN initial_diagnosis TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN additional_observations TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN before_work_condition VARCHAR(255) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN initial_inspection_remarks TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN parts_replaced_summary TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN repair_details TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN additional_remarks TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN final_machine_condition VARCHAR(255) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN work_completion_remarks TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN parts_total DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN labour_total DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN shipping_charge DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE customer_support_job_cards ADD COLUMN payment_status ENUM('Paid', 'Partially Paid', 'Unpaid') NOT NULL DEFAULT 'Unpaid'",
            "ALTER TABLE customer_support_job_cards ADD COLUMN payment_mode VARCHAR(50) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN work_completion_date DATETIME NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN customer_feedback TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN technician_remarks TEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN completed_by INT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN completed_by_name VARCHAR(150) NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN customer_signature LONGTEXT NULL",
            "ALTER TABLE customer_support_job_cards ADD COLUMN signature_date DATETIME NULL"
        ];
        for (const sql of jobCardExtraCols) {
            try {
                await db.query(sql);
            } catch (e) {
                if (!e.message.includes('Duplicate column')) {
                    console.warn("job_card column notice:", e.message);
                }
            }
        }

        // Preserve & backfill existing historical Job Card data
        await db.query("UPDATE customer_support_job_cards SET job_card_date = DATE(created_at) WHERE job_card_date IS NULL");
        await db.query("UPDATE customer_support_job_cards SET machine_make_model = product_summary WHERE machine_make_model IS NULL AND product_summary IS NOT NULL");
        await db.query("UPDATE customer_support_job_cards SET original_issue_description = issue_description WHERE original_issue_description IS NULL AND issue_description IS NOT NULL");
        await db.query("UPDATE customer_support_job_cards SET work_completion_date = completed_at WHERE work_completion_date IS NULL AND completed_at IS NOT NULL");
        await db.query("UPDATE customer_support_job_cards SET completed_by = assigned_to WHERE completed_by IS NULL AND status = 'Completed' AND assigned_to IS NOT NULL");

        // Enhance customer_support_job_card_parts
        await db.query("ALTER TABLE customer_support_job_card_parts MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00");
        try {
            await db.query("ALTER TABLE customer_support_job_card_parts ADD COLUMN is_foc TINYINT(1) NOT NULL DEFAULT 0");
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.warn("parts is_foc notice:", e.message);
        }

        // 13. customer_support_job_card_labour table
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_support_job_card_labour (
                labour_id INT AUTO_INCREMENT PRIMARY KEY,
                job_card_id INT NOT NULL,
                labour_description VARCHAR(255) NOT NULL,
                hours DECIMAL(10,2) NOT NULL DEFAULT 1.00,
                rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                remarks VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_job_card_id (job_card_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table 'customer_support_job_card_labour' ready.");

        // Enhance customer_support_job_card_photos (support BEFORE_WORK / AFTER_WORK while preserving legacy types)
        await db.query(`
            ALTER TABLE customer_support_job_card_photos
            MODIFY COLUMN photo_type ENUM('BEFORE_WORK', 'AFTER_WORK', 'issue', 'before', 'after', 'other') NOT NULL DEFAULT 'BEFORE_WORK'
        `);
        try {
            await db.query("ALTER TABLE customer_support_job_card_photos ADD COLUMN caption VARCHAR(255) NULL");
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.warn("photos caption notice:", e.message);
        }

        console.log('✅ Customer Support Migration Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

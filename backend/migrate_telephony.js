const pool = require('./src/config/db');

async function migrateTelephony() {
    console.log("🚀 Starting Telephony Database Migration...");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. telephony_integrations
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_integrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                provider ENUM('acefone') NOT NULL DEFAULT 'acefone',
                name VARCHAR(100) NOT NULL DEFAULT 'Acefone Cloud Telephony',
                base_url VARCHAR(255) NOT NULL DEFAULT 'https://api.acefone.in',
                environment ENUM('production', 'staging', 'development') NOT NULL DEFAULT 'production',
                status ENUM('active', 'inactive', 'disabled') NOT NULL DEFAULT 'active',
                health_status ENUM('healthy', 'degraded', 'failed', 'unknown') NOT NULL DEFAULT 'unknown',
                manual_fallback_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                last_connection_test_at DATETIME NULL,
                last_connection_success_at DATETIME NULL,
                last_webhook_at DATETIME NULL,
                last_sync_at DATETIME NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_integrations' ready.");

        // 2. telephony_credentials
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_credentials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                credential_type ENUM('api_token', 'support_api_key') NOT NULL DEFAULT 'api_token',
                credential_name VARCHAR(100) NOT NULL DEFAULT 'Default Acefone Token',
                encrypted_value TEXT NOT NULL,
                credential_last_four VARCHAR(10) NOT NULL,
                scopes JSON NULL,
                ip_restriction_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                expires_at DATETIME NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_used_at DATETIME NULL,
                last_tested_at DATETIME NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT,
                FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_credentials' ready.");

        // 3. telephony_dids
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_dids (
                id INT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                acefone_did_id VARCHAR(100) NULL,
                did_number VARCHAR(20) NOT NULL,
                display_name VARCHAR(100) NULL,
                location VARCHAR(100) NULL,
                provider_status VARCHAR(50) NULL,
                status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
                number_type VARCHAR(50) NOT NULL DEFAULT 'landline',
                country_code VARCHAR(10) NOT NULL DEFAULT '+91',
                is_available BOOLEAN NOT NULL DEFAULT TRUE,
                last_synced_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_did_integration_number (integration_id, did_number),
                KEY idx_dids_acefone_did (integration_id, acefone_did_id),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_dids' ready.");

        // 4. telephony_agents
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_agents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                crm_user_id INT NOT NULL,
                acefone_user_id VARCHAR(100) NOT NULL,
                acefone_agent_id VARCHAR(100) NOT NULL,
                agent_name VARCHAR(150) NOT NULL,
                agent_phone VARCHAR(20) NULL,
                extension VARCHAR(20) NULL,
                login_id VARCHAR(100) NULL,
                default_outbound_did_id INT NULL,
                calling_channel ENUM('extension', 'mobile', 'both') NOT NULL DEFAULT 'extension',
                agent_status ENUM('active', 'inactive', 'busy', 'offline') NOT NULL DEFAULT 'active',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_synced_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_agent_integration_crm (integration_id, crm_user_id),
                UNIQUE KEY uk_agent_integration_acefone_user (integration_id, acefone_user_id),
                UNIQUE KEY uk_agent_integration_acefone_agent (integration_id, acefone_agent_id),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE CASCADE,
                FOREIGN KEY (crm_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
                FOREIGN KEY (default_outbound_did_id) REFERENCES telephony_dids(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_agents' ready.");

        // 5. telephony_agent_dids
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_agent_dids (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telephony_agent_id INT NOT NULL,
                did_id INT NOT NULL,
                can_outbound BOOLEAN NOT NULL DEFAULT TRUE,
                can_inbound BOOLEAN NOT NULL DEFAULT TRUE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                assigned_by INT NULL,
                unassigned_at DATETIME NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_agent_did (telephony_agent_id, did_id),
                FOREIGN KEY (telephony_agent_id) REFERENCES telephony_agents(id) ON DELETE RESTRICT,
                FOREIGN KEY (did_id) REFERENCES telephony_dids(id) ON DELETE RESTRICT,
                FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_agent_dids' ready.");

        // 6. telephony_call_settings
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_call_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL UNIQUE,
                default_call_timeout INT NOT NULL DEFAULT 3600,
                default_calling_channel ENUM('extension', 'mobile', 'both') NOT NULL DEFAULT 'extension',
                recording_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                webhook_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                cdr_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                live_call_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                manual_fallback_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                default_did_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE CASCADE,
                FOREIGN KEY (default_did_id) REFERENCES telephony_dids(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_call_settings' ready.");

        // 7. telephony_dispositions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_dispositions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                description TEXT NULL,
                requires_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
                can_create_order BOOLEAN NOT NULL DEFAULT FALSE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_dispositions' ready.");

        // 8. telephony_calls
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_calls (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                lead_id INT NULL,
                customer_id INT NULL,
                crm_user_id INT NULL,
                telephony_agent_id INT NULL,
                did_id INT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                agent_phone VARCHAR(20) NULL,
                agent_extension VARCHAR(20) NULL,
                direction ENUM('inbound', 'outbound') NOT NULL DEFAULT 'outbound',
                call_type ENUM('click_to_call', 'inbound', 'outbound') NOT NULL DEFAULT 'click_to_call',
                calling_channel ENUM('extension', 'mobile', 'both') NOT NULL DEFAULT 'extension',
                provider ENUM('acefone') NOT NULL DEFAULT 'acefone',
                acefone_ref_id VARCHAR(100) NULL,
                acefone_call_id VARCHAR(100) NULL,
                acefone_uuid VARCHAR(100) NULL,
                technical_status ENUM(
                    'REQUESTED', 'RINGING_AGENT', 'AGENT_ANSWERED',
                    'RINGING_CUSTOMER', 'CUSTOMER_ANSWERED', 'CONNECTED',
                    'MISSED', 'BUSY', 'FAILED', 'COMPLETED', 'CANCELLED', 'UNKNOWN'
                ) NOT NULL DEFAULT 'REQUESTED',
                hangup_cause VARCHAR(100) NULL,
                hangup_reason TEXT NULL,
                started_at DATETIME NOT NULL,
                agent_answered_at DATETIME NULL,
                customer_answered_at DATETIME NULL,
                connected_at DATETIME NULL,
                ended_at DATETIME NULL,
                duration_seconds INT NOT NULL DEFAULT 0,
                talk_time_seconds INT NOT NULL DEFAULT 0,
                ring_time_seconds INT NOT NULL DEFAULT 0,
                is_recorded BOOLEAN NOT NULL DEFAULT FALSE,
                disposition_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_call_integration_ref (integration_id, acefone_ref_id),
                KEY idx_calls_lead (lead_id, started_at),
                KEY idx_calls_customer (customer_id, started_at),
                KEY idx_calls_user (crm_user_id, started_at),
                KEY idx_calls_agent (telephony_agent_id, started_at),
                KEY idx_calls_did (did_id, started_at),
                KEY idx_calls_phone (customer_phone, started_at),
                KEY idx_calls_acefone_call_id (acefone_call_id),
                KEY idx_calls_acefone_uuid (acefone_uuid),
                KEY idx_calls_direction (direction, started_at),
                KEY idx_calls_status (technical_status, started_at),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT,
                FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL,
                FOREIGN KEY (customer_id) REFERENCES dealers(dealer_id) ON DELETE SET NULL,
                FOREIGN KEY (crm_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
                FOREIGN KEY (telephony_agent_id) REFERENCES telephony_agents(id) ON DELETE SET NULL,
                FOREIGN KEY (did_id) REFERENCES telephony_dids(id) ON DELETE SET NULL,
                FOREIGN KEY (disposition_id) REFERENCES telephony_dispositions(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_calls' ready.");

        // 9. telephony_call_events
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_call_events (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                call_id BIGINT NULL,
                integration_id INT NOT NULL,
                acefone_ref_id VARCHAR(100) NULL,
                acefone_call_id VARCHAR(100) NULL,
                acefone_uuid VARCHAR(100) NULL,
                provider_event_id VARCHAR(100) NULL,
                event_type VARCHAR(100) NOT NULL,
                event_status VARCHAR(50) NULL,
                payload_json JSON NOT NULL,
                received_at DATETIME NOT NULL,
                processed_at DATETIME NULL,
                processing_status ENUM('pending', 'processed', 'failed', 'ignored') NOT NULL DEFAULT 'pending',
                processing_error TEXT NULL,
                retry_count INT NOT NULL DEFAULT 0,
                event_hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_event_hash (integration_id, event_hash),
                KEY idx_events_call (call_id),
                KEY idx_events_ref (acefone_ref_id),
                KEY idx_events_provider_event (integration_id, provider_event_id),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT,
                FOREIGN KEY (call_id) REFERENCES telephony_calls(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_call_events' ready.");

        // 10. telephony_recordings
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_recordings (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                call_id BIGINT NOT NULL UNIQUE,
                integration_id INT NOT NULL,
                acefone_recording_id VARCHAR(100) NULL,
                acefone_recording_url TEXT NULL,
                r2_bucket VARCHAR(100) NULL,
                r2_object_key VARCHAR(255) NULL,
                file_name VARCHAR(150) NULL,
                mime_type VARCHAR(50) NOT NULL DEFAULT 'audio/mpeg',
                file_size_bytes BIGINT NOT NULL DEFAULT 0,
                duration_seconds INT NOT NULL DEFAULT 0,
                upload_status ENUM('pending', 'uploading', 'uploaded', 'failed') NOT NULL DEFAULT 'pending',
                uploaded_at DATETIME NULL,
                checksum VARCHAR(64) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (call_id) REFERENCES telephony_calls(id) ON DELETE RESTRICT,
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_recordings' ready.");

        // 11. telephony_webhook_logs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_webhook_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                request_id VARCHAR(100) NOT NULL,
                provider_event_id VARCHAR(100) NULL,
                http_method VARCHAR(10) NOT NULL DEFAULT 'POST',
                endpoint VARCHAR(255) NOT NULL,
                headers_json JSON NULL,
                payload_json JSON NOT NULL,
                http_status INT NOT NULL DEFAULT 200,
                response_body TEXT NULL,
                processing_status ENUM('pending', 'processed', 'failed', 'ignored') NOT NULL DEFAULT 'pending',
                error_message TEXT NULL,
                received_at DATETIME NOT NULL,
                processed_at DATETIME NULL,
                duration_ms INT NOT NULL DEFAULT 0,
                retry_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_wh_request (request_id),
                KEY idx_wh_provider_event (provider_event_id),
                KEY idx_wh_date (received_at),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_webhook_logs' ready.");

        // 12. telephony_api_logs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_api_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                crm_user_id INT NULL,
                api_name VARCHAR(100) NOT NULL,
                http_method VARCHAR(10) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                request_id VARCHAR(100) NULL,
                request_payload JSON NULL,
                response_status INT NOT NULL,
                response_body TEXT NULL,
                duration_ms INT NOT NULL DEFAULT 0,
                success BOOLEAN NOT NULL DEFAULT TRUE,
                error_code VARCHAR(50) NULL,
                error_message TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_api_logs_user (crm_user_id),
                KEY idx_api_logs_date (created_at),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT,
                FOREIGN KEY (crm_user_id) REFERENCES users(user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_api_logs' ready.");

        // 13. telephony_sync_logs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_sync_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                sync_type ENUM('agents', 'dids', 'cdr', 'recordings') NOT NULL,
                sync_source ENUM('crm', 'acefone', 'webhook', 'scheduled_sync', 'admin') NOT NULL DEFAULT 'admin',
                started_at DATETIME NOT NULL,
                completed_at DATETIME NULL,
                status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
                records_fetched INT NOT NULL DEFAULT 0,
                records_created INT NOT NULL DEFAULT 0,
                records_updated INT NOT NULL DEFAULT 0,
                records_deactivated INT NOT NULL DEFAULT 0,
                records_failed INT NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_sync_logs' ready.");

        // 14. telephony_audit_logs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS telephony_audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                integration_id INT NOT NULL,
                admin_user_id INT NULL,
                sync_source ENUM('crm', 'acefone', 'webhook', 'scheduled_sync', 'admin') NOT NULL DEFAULT 'admin',
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(50) NOT NULL,
                action VARCHAR(50) NOT NULL,
                old_values JSON NULL,
                new_values JSON NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_audit_admin (admin_user_id),
                KEY idx_audit_entity (entity_type, entity_id),
                FOREIGN KEY (integration_id) REFERENCES telephony_integrations(id) ON DELETE RESTRICT,
                FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("  ✅ Table 'telephony_audit_logs' ready.");

        // --- SEED INITIAL DATA ---
        // Seed default integration
        const [existingIntegrations] = await connection.query(`SELECT id FROM telephony_integrations WHERE provider = 'acefone' LIMIT 1`);
        let integrationId;
        if (existingIntegrations.length === 0) {
            const [result] = await connection.query(`
                INSERT INTO telephony_integrations (provider, name, base_url, environment, status, health_status)
                VALUES ('acefone', 'Acefone Cloud Telephony', 'https://api.acefone.in', 'production', 'active', 'healthy')
            `);
            integrationId = result.insertId;
            console.log(`  🌱 Seeded default Acefone integration (ID: ${integrationId})`);
        } else {
            integrationId = existingIntegrations[0].id;
        }

        // Seed default settings
        const [existingSettings] = await connection.query(`SELECT id FROM telephony_call_settings WHERE integration_id = ?`, [integrationId]);
        if (existingSettings.length === 0) {
            await connection.query(`
                INSERT INTO telephony_call_settings (integration_id, default_call_timeout, default_calling_channel, recording_enabled, webhook_enabled, cdr_sync_enabled)
                VALUES (?, 3600, 'extension', TRUE, TRUE, TRUE)
            `, [integrationId]);
            console.log("  🌱 Seeded default telephony call settings.");
        }

        // Seed default dispositions
        const defaultDispositions = [
            { code: 'RECEIVED', name: 'Connected / Discussed', reqFollowup: false, canOrder: true, sort: 1 },
            { code: 'NOT_RECEIVED', name: 'No Answer / Unreachable', reqFollowup: true, canOrder: false, sort: 2 },
            { code: 'BUSY', name: 'Line Busy', reqFollowup: true, canOrder: false, sort: 3 },
            { code: 'INTERESTED', name: 'Interested - High Intent', reqFollowup: true, canOrder: true, sort: 4 },
            { code: 'FOLLOW_UP', name: 'Follow Up Required', reqFollowup: true, canOrder: false, sort: 5 },
            { code: 'ORDER', name: 'Converted to Order', reqFollowup: false, canOrder: true, sort: 6 },
            { code: 'NOT_INTERESTED', name: 'Not Interested', reqFollowup: false, canOrder: false, sort: 7 },
            { code: 'WRONG_NUMBER', name: 'Wrong Number / Invalid', reqFollowup: false, canOrder: false, sort: 8 }
        ];

        for (const disp of defaultDispositions) {
            await connection.query(`
                INSERT INTO telephony_dispositions (code, name, requires_follow_up, can_create_order, sort_order)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE name = VALUES(name)
            `, [disp.code, disp.name, disp.reqFollowup, disp.canOrder, disp.sort]);
        }
        console.log("  🌱 Seeded default sales dispositions.");

        await connection.commit();
        console.log("\n🎉 Telephony Database Migration Completed Successfully!");
    } catch (error) {
        await connection.rollback();
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrateTelephony();

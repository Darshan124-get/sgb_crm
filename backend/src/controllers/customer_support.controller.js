const db = require('../config/db');
const customerSupportService = require('../services/customer_support.service');
const path = require('path');

// ── GET DASHBOARD METRICS ──
exports.getDashboardMetrics = async (req, res) => {
    try {
        // Trigger follow-up status check on dashboard load
        await customerSupportService.processDueFollowups().catch(e => console.warn('processDueFollowups warn:', e.message));

        const metrics = await customerSupportService.getDashboardMetrics(req.user);
        res.json({ success: true, metrics });
    } catch (err) {
        console.error('Error in getDashboardMetrics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
    }
};

// ── GET CASES (Paginated with filters) ──
exports.getCases = async (req, res) => {
    try {
        const { status, search, assigned_to, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClauses = ['1=1'];
        let params = [];

        // PBAC: Executives see their own assigned cases + unassigned cases
        const role = (req.user.role || '').toLowerCase();
        const isManagerOrAdmin = role === 'admin' || role === 'super-admin' || req.user.is_manager || role.includes('manager');
        if (!isManagerOrAdmin && req.user && req.user.id) {
            whereClauses.push('(c.assigned_to = ? OR c.assigned_to IS NULL)');
            params.push(req.user.id);
        } else if (assigned_to) {
            whereClauses.push('c.assigned_to = ?');
            params.push(assigned_to);
        }

        // Status filter
        if (status) {
            if (status === 'orders_delivered' || status === 'delivered') {
                whereClauses.push("c.status = 'delivered'");
            } else if (status === 'contacted_followup') {
                whereClauses.push("c.status IN ('pending_contact', 'contacted', 'guidance_in_progress')");
            } else if (status === 'completed') {
                whereClauses.push("c.status = 'completed'");
            } else {
                whereClauses.push('c.status = ?');
                params.push(status);
            }
        }

        // Search query
        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            whereClauses.push('(c.customer_name LIKE ? OR c.customer_phone LIKE ? OR c.case_number LIKE ? OR CAST(c.order_id AS CHAR) LIKE ?)');
            params.push(q, q, q, q);
        }

        const whereSql = whereClauses.join(' AND ');

        // Count
        const [[countRow]] = await db.query(
            `SELECT COUNT(*) as total FROM customer_support_cases c WHERE ${whereSql}`,
            params
        );

        // Fetch
        const [cases] = await db.query(`
            SELECT c.*, 
                   u.name as assigned_name, 
                   o.total_amount, o.order_status, o.address, o.city, o.state, o.pincode,
                   (SELECT COUNT(*) FROM customer_support_calls WHERE case_id = c.case_id) as call_count,
                   (SELECT COUNT(*) FROM customer_support_notes WHERE case_id = c.case_id) as note_count,
                   (SELECT COUNT(*) FROM customer_support_photos WHERE case_id = c.case_id) as photo_count,
                   (SELECT scheduled_date FROM customer_support_followups WHERE case_id = c.case_id LIMIT 1) as followup_date,
                   (SELECT status FROM customer_support_followups WHERE case_id = c.case_id LIMIT 1) as followup_status
            FROM customer_support_cases c
            LEFT JOIN users u ON c.assigned_to = u.user_id
            LEFT JOIN orders o ON c.order_id = o.order_id
            WHERE ${whereSql}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        res.json({
            success: true,
            cases,
            pagination: {
                total: countRow.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countRow.total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error in getCases:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch customer support cases' });
    }
};

// ── GET SINGLE CASE DETAILS ──
exports.getCaseDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [cases] = await db.query(`
            SELECT c.*, 
                   u.name as assigned_name, u.email as assigned_email, u.phone as assigned_phone,
                   o.total_amount, o.order_status, o.created_at as order_created_at,
                   o.address, o.city, o.state, o.district, o.pincode, o.village, o.sub_district,
                   o.delivery_type, o.dispatch_through, o.purchase_source,
                   l.current_crop, l.acreage, l.language as lead_language
            FROM customer_support_cases c
            LEFT JOIN users u ON c.assigned_to = u.user_id
            LEFT JOIN orders o ON c.order_id = o.order_id
            LEFT JOIN leads l ON c.lead_id = l.lead_id
            WHERE c.case_id = ?
        `, [id]);

        if (cases.length === 0) {
            return res.status(404).json({ success: false, message: 'Support case not found' });
        }

        const supportCase = cases[0];

        // Fetch order products
        const [orderItems] = await db.query(`
            SELECT oi.*, p.name as product_name, p.sku, p.category, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = ?
        `, [supportCase.order_id]);

        // Fetch calls
        const [calls] = await db.query(`
            SELECT sc.*, u.name as caller_name
            FROM customer_support_calls sc
            LEFT JOIN users u ON sc.created_by = u.user_id
            WHERE sc.case_id = ?
            ORDER BY sc.created_at DESC
        `, [id]);

        // Fetch notes
        const [notes] = await db.query(`
            SELECT sn.*, u.name as author_name
            FROM customer_support_notes sn
            LEFT JOIN users u ON sn.created_by = u.user_id
            WHERE sn.case_id = ?
            ORDER BY sn.created_at DESC
        `, [id]);

        // Fetch photos
        const [photos] = await db.query(`
            SELECT sp.*, u.name as uploader_name
            FROM customer_support_photos sp
            LEFT JOIN users u ON sp.uploaded_by = u.user_id
            WHERE sp.case_id = ?
            ORDER BY sp.created_at DESC
        `, [id]);

        // Fetch follow-ups
        const [followups] = await db.query(`
            SELECT fu.*, u.name as assigned_name
            FROM customer_support_followups fu
            LEFT JOIN users u ON fu.assigned_to = u.user_id
            WHERE fu.case_id = ?
            ORDER BY fu.created_at DESC
        `, [id]);

        res.json({
            success: true,
            case: supportCase,
            order_items: orderItems,
            calls,
            notes,
            photos,
            followups
        });
    } catch (err) {
        console.error('Error in getCaseDetails:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch case details' });
    }
};

// ── RECORD CALL ──
exports.recordCall = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            call_type = 'INITIAL',
            call_outcome,
            installation_status,
            guidance_provided,
            installation_instructions,
            product_usage_guidance,
            customer_questions,
            reported_problems,
            feedback,
            remarks
        } = req.body;

        if (!call_outcome) {
            return res.status(400).json({ success: false, message: 'Call outcome is required' });
        }

        const validOutcomes = ['answered', 'not_answered', 'callback_required', 'no_assistance_needed'];
        if (!validOutcomes.includes(call_outcome)) {
            return res.status(400).json({ success: false, message: 'Invalid call outcome' });
        }

        // Insert call
        const [callResult] = await db.query(`
            INSERT INTO customer_support_calls
            (case_id, call_type, call_outcome, installation_status, guidance_provided, installation_instructions, product_usage_guidance, customer_questions, reported_problems, feedback, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            call_type,
            call_outcome,
            installation_status || null,
            guidance_provided || null,
            installation_instructions || null,
            product_usage_guidance || null,
            customer_questions || null,
            reported_problems || null,
            feedback || null,
            remarks || null,
            req.user.id || req.user.user_id
        ]);

        const callId = callResult.insertId;

        // Update case status according to outcome
        let newCaseStatus = 'pending_contact';
        if (call_outcome === 'answered') {
            newCaseStatus = (installation_status === 'successfully_installed') ? 'contacted' : 'guidance_in_progress';
        } else if (call_outcome === 'callback_required') {
            newCaseStatus = 'pending_contact';
        } else if (call_outcome === 'no_assistance_needed') {
            newCaseStatus = 'contacted';
        }

        await db.query(`
            UPDATE customer_support_cases 
            SET status = ?, installation_status = COALESCE(?, installation_status), initial_call_date = COALESCE(initial_call_date, NOW())
            WHERE case_id = ?
        `, [newCaseStatus, installation_status || null, id]);

        // Auto note
        await db.query(`
            INSERT INTO customer_support_notes (case_id, call_id, note, created_by)
            VALUES (?, ?, ?, ?)
        `, [
            id,
            callId,
            `Call logged [${call_type}]: Outcome was "${call_outcome}". Installation status: ${installation_status || 'N/A'}. ${remarks ? 'Remarks: ' + remarks : ''}`,
            req.user.id || req.user.user_id
        ]);

        res.json({
            success: true,
            message: 'Call recorded successfully',
            call_id: callId,
            new_status: newCaseStatus
        });
    } catch (err) {
        console.error('Error in recordCall:', err);
        res.status(500).json({ success: false, message: 'Failed to record call' });
    }
};

// ── ADD NOTE ──
exports.addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, call_id } = req.body;

        if (!note || !note.trim()) {
            return res.status(400).json({ success: false, message: 'Note text cannot be empty' });
        }

        const [result] = await db.query(`
            INSERT INTO customer_support_notes (case_id, call_id, note, created_by)
            VALUES (?, ?, ?, ?)
        `, [id, call_id || null, note.trim(), req.user.id || req.user.user_id]);

        res.json({
            success: true,
            message: 'Note added successfully',
            note_id: result.insertId
        });
    } catch (err) {
        console.error('Error in addNote:', err);
        res.status(500).json({ success: false, message: 'Failed to add note' });
    }
};

// ── UPLOAD PHOTOS ──
exports.uploadPhotos = async (req, res) => {
    try {
        const { id } = req.params;
        const { call_id } = req.body;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({ success: false, message: 'No photos provided for upload' });
        }

        const uploadedPhotos = [];
        for (const file of files) {
            const fileUrl = `/uploads/${file.filename}`;
            const [result] = await db.query(`
                INSERT INTO customer_support_photos (case_id, call_id, file_url, file_name, file_size, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, call_id || null, fileUrl, file.originalname, file.size, req.user.id || req.user.user_id]);

            uploadedPhotos.push({
                photo_id: result.insertId,
                file_url: fileUrl,
                file_name: file.originalname
            });
        }

        res.json({
            success: true,
            message: `${files.length} photo(s) uploaded successfully`,
            photos: uploadedPhotos
        });
    } catch (err) {
        console.error('Error in uploadPhotos:', err);
        res.status(500).json({ success: false, message: 'Failed to upload photos' });
    }
};

// ── COMPLETE INITIAL SUPPORT & SCHEDULE 30-DAY FOLLOW-UP ──
exports.completeSupport = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            call_outcome,
            installation_status,
            guidance_provided,
            notes,
            remarks
        } = req.body;

        // Validation
        if (!call_outcome) {
            return res.status(400).json({ success: false, message: 'Call outcome is required to complete support' });
        }
        if (call_outcome === 'not_answered' || call_outcome === 'callback_required') {
            return res.status(400).json({
                success: false,
                message: 'Cannot mark support complete while customer is not answered or callback is required. Please retain case open.'
            });
        }
        if (!installation_status) {
            return res.status(400).json({ success: false, message: 'Installation status is required' });
        }

        // Fetch case
        const [cases] = await db.query('SELECT * FROM customer_support_cases WHERE case_id = ?', [id]);
        if (cases.length === 0) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }
        const supportCase = cases[0];

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Record call
            const [callResult] = await connection.query(`
                INSERT INTO customer_support_calls
                (case_id, call_type, call_outcome, installation_status, guidance_provided, remarks, created_by)
                VALUES (?, 'INITIAL', ?, ?, ?, ?, ?)
            `, [
                id,
                call_outcome,
                installation_status,
                guidance_provided || 'Installation instructions and product guidance completed successfully.',
                remarks || 'Initial support concluded.',
                req.user.id || req.user.user_id
            ]);
            const callId = callResult.insertId;

            // 2. Record note
            if (notes && notes.trim()) {
                await connection.query(`
                    INSERT INTO customer_support_notes (case_id, call_id, note, created_by)
                    VALUES (?, ?, ?, ?)
                `, [id, callId, notes.trim(), req.user.id || req.user.user_id]);
            }

            // 3. Mark Case as Completed
            await connection.query(`
                UPDATE customer_support_cases
                SET status = 'completed', installation_status = ?, completed_at = NOW()
                WHERE case_id = ?
            `, [installation_status, id]);

            // 4. Automatically Schedule 30-Day Follow-Up (exact 30 calendar days later)
            const scheduledDateQuery = `SELECT DATE_ADD(CURDATE(), INTERVAL 30 DAY) as follow_date`;
            const [[dateRow]] = await connection.query(scheduledDateQuery);
            const scheduledDate = dateRow.follow_date;

            // Prevent duplicate follow-up record
            const [existingFollowup] = await connection.query(
                'SELECT followup_id FROM customer_support_followups WHERE case_id = ? AND followup_type = "30_DAY_PRODUCT_CHECK"',
                [id]
            );

            let followupId = null;
            if (existingFollowup.length === 0) {
                const [fuResult] = await connection.query(`
                    INSERT INTO customer_support_followups
                    (case_id, order_id, customer_name, customer_phone, assigned_to, followup_type, scheduled_date, status)
                    VALUES (?, ?, ?, ?, ?, '30_DAY_PRODUCT_CHECK', ?, 'UPCOMING')
                `, [
                    id,
                    supportCase.order_id,
                    supportCase.customer_name,
                    supportCase.customer_phone,
                    supportCase.assigned_to || req.user.id,
                    scheduledDate
                ]);
                followupId = fuResult.insertId;
            } else {
                followupId = existingFollowup[0].followup_id;
            }

            // 5. In-app notification to executive that follow-up has been scheduled
            const executiveId = supportCase.assigned_to || req.user.id;
            const notifTitle = '30-Day Follow-Up Scheduled';
            const notifMsg = `30-Day follow-up for Customer ${supportCase.customer_name} (Order #${supportCase.order_id}) has been scheduled for ${new Date(scheduledDate).toLocaleDateString('en-IN')}.`;
            const notifLink = `modules/customer_support/followup_details.html?followup_id=${followupId}`;

            await connection.query(`
                INSERT INTO notifications (order_id, user_id, title, message, type, link, data, status)
                VALUES (?, ?, ?, ?, 'customer_support_followup_scheduled', ?, ?, 'sent')
            `, [
                supportCase.order_id,
                executiveId,
                notifTitle,
                notifMsg,
                notifLink,
                JSON.stringify({ caseId: id, orderId: supportCase.order_id, followupId, scheduledDate })
            ]);

            await connection.commit();

            res.json({
                success: true,
                message: 'Support completed successfully. 30-day follow-up has been scheduled.',
                scheduled_date: scheduledDate,
                followup_id: followupId
            });

        } catch (innerErr) {
            await connection.rollback();
            throw innerErr;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Error in completeSupport:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to complete support' });
    }
};

// ── GET FOLLOW-UPS LIST ──
exports.getFollowups = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Process due follow-ups to ensure status is up to date
        await customerSupportService.processDueFollowups().catch(e => console.warn(e.message));

        let whereClauses = ['1=1'];
        let params = [];

        // Role-based visibility
        const role = (req.user.role || '').toLowerCase();
        const isManagerOrAdmin = role === 'admin' || role === 'super-admin' || req.user.is_manager || role.includes('manager');
        if (!isManagerOrAdmin && req.user && req.user.id) {
            whereClauses.push('(f.assigned_to = ? OR f.assigned_to IS NULL)');
            params.push(req.user.id);
        }

        if (status) {
            whereClauses.push('f.status = ?');
            params.push(status.toUpperCase());
        }

        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            whereClauses.push('(f.customer_name LIKE ? OR f.customer_phone LIKE ? OR CAST(f.order_id AS CHAR) LIKE ? OR c.case_number LIKE ?)');
            params.push(q, q, q, q);
        }

        const whereSql = whereClauses.join(' AND ');

        const [[countRow]] = await db.query(
            `SELECT COUNT(*) as total FROM customer_support_followups f JOIN customer_support_cases c ON f.case_id = c.case_id WHERE ${whereSql}`,
            params
        );

        const [followups] = await db.query(`
            SELECT f.*, c.case_number, c.product_summary, c.delivery_date, c.completed_at as initial_support_completed_at,
                   u.name as assigned_name
            FROM customer_support_followups f
            JOIN customer_support_cases c ON f.case_id = c.case_id
            LEFT JOIN users u ON f.assigned_to = u.user_id
            WHERE ${whereSql}
            ORDER BY 
                CASE 
                    WHEN f.status = 'DUE' THEN 1
                    WHEN f.status = 'OVERDUE' THEN 2
                    WHEN f.status = 'UPCOMING' THEN 3
                    ELSE 4
                END,
                f.scheduled_date ASC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        res.json({
            success: true,
            followups,
            pagination: {
                total: countRow.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countRow.total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error in getFollowups:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch follow-ups' });
    }
};

// ── GET SINGLE FOLLOW-UP DETAILS ──
exports.getFollowupDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [followups] = await db.query(`
            SELECT f.*, c.case_number, c.customer_name, c.customer_phone, c.product_summary, c.delivery_date,
                   c.installation_status, c.completed_at as support_completed_at,
                   u.name as assigned_name,
                   o.total_amount, o.address, o.city, o.state, o.pincode
            FROM customer_support_followups f
            JOIN customer_support_cases c ON f.case_id = c.case_id
            LEFT JOIN users u ON f.assigned_to = u.user_id
            LEFT JOIN orders o ON f.order_id = o.order_id
            WHERE f.followup_id = ?
        `, [id]);

        if (followups.length === 0) {
            return res.status(404).json({ success: false, message: 'Follow-up not found' });
        }

        const followup = followups[0];

        // Fetch historical calls and notes for context
        const [calls] = await db.query(`
            SELECT sc.*, u.name as caller_name
            FROM customer_support_calls sc
            LEFT JOIN users u ON sc.created_by = u.user_id
            WHERE sc.case_id = ?
            ORDER BY sc.created_at DESC
        `, [followup.case_id]);

        const [notes] = await db.query(`
            SELECT sn.*, u.name as author_name
            FROM customer_support_notes sn
            LEFT JOIN users u ON sn.created_by = u.user_id
            WHERE sn.case_id = ?
            ORDER BY sn.created_at DESC
        `, [followup.case_id]);

        const [photos] = await db.query(`
            SELECT * FROM customer_support_photos WHERE case_id = ? ORDER BY created_at DESC
        `, [followup.case_id]);

        res.json({
            success: true,
            followup,
            calls,
            notes,
            photos
        });
    } catch (err) {
        console.error('Error in getFollowupDetails:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch follow-up details' });
    }
};

// ── RECORD FOLLOW-UP CALL & COMPLETE FOLLOW-UP ──
exports.recordFollowupCall = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            product_condition,
            any_issues,
            customer_feedback,
            issue_description,
            next_action,
            remarks
        } = req.body;

        if (!product_condition) {
            return res.status(400).json({ success: false, message: 'Product condition is required' });
        }
        if (!any_issues) {
            return res.status(400).json({ success: false, message: 'Any issues status is required' });
        }
        if (!customer_feedback || !customer_feedback.trim()) {
            return res.status(400).json({ success: false, message: 'Customer feedback details are required' });
        }

        const [followups] = await db.query('SELECT * FROM customer_support_followups WHERE followup_id = ?', [id]);
        if (followups.length === 0) {
            return res.status(404).json({ success: false, message: 'Follow-up record not found' });
        }
        const fu = followups[0];

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Update follow-up record
            await connection.query(`
                UPDATE customer_support_followups
                SET product_condition = ?,
                    any_issues = ?,
                    customer_feedback = ?,
                    issue_description = ?,
                    next_action = ?,
                    remarks = ?,
                    status = 'COMPLETED',
                    completed_at = NOW()
                WHERE followup_id = ?
            `, [
                product_condition,
                any_issues,
                customer_feedback.trim(),
                issue_description || null,
                next_action || 'no_action_required',
                remarks || null,
                id
            ]);

            // 2. Record in customer_support_calls with call_type = 'FOLLOW_UP'
            await connection.query(`
                INSERT INTO customer_support_calls
                (case_id, call_type, call_outcome, feedback, remarks, created_by)
                VALUES (?, 'FOLLOW_UP', 'answered', ?, ?, ?)
            `, [
                fu.case_id,
                `30-Day Follow-Up: Condition=${product_condition}, Issues=${any_issues}. Feedback: ${customer_feedback}`,
                remarks || `Next Action: ${next_action || 'no_action_required'}`,
                req.user.id || req.user.user_id
            ]);

            // 3. Add to notes history
            await connection.query(`
                INSERT INTO customer_support_notes (case_id, note, created_by)
                VALUES (?, ?, ?)
            `, [
                fu.case_id,
                `30-Day Follow-Up Completed: Product condition is "${product_condition}". Issues: ${any_issues}. Next action: ${next_action || 'no_action_required'}. Feedback: ${customer_feedback}`,
                req.user.id || req.user.user_id
            ]);

            await connection.commit();

            res.json({
                success: true,
                message: 'Follow-up call recorded and task completed successfully.'
            });

        } catch (innerErr) {
            await connection.rollback();
            throw innerErr;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Error in recordFollowupCall:', err);
        res.status(500).json({ success: false, message: 'Failed to record follow-up call' });
    }
};

// ── GET IN-APP NOTIFICATIONS ──
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id || req.user.user_id;
        const [notifications] = await db.query(`
            SELECT * FROM notifications 
            WHERE (user_id = ? OR (user_id IS NULL AND type LIKE 'customer_support%'))
            ORDER BY created_at DESC 
            LIMIT 30
        `, [userId]);

        const [[unreadRow]] = await db.query(`
            SELECT COUNT(*) as unread_count 
            FROM notifications 
            WHERE (user_id = ? OR (user_id IS NULL AND type LIKE 'customer_support%'))
              AND (is_read = 0 OR is_read IS NULL)
        `, [userId]);

        res.json({
            success: true,
            notifications,
            unread_count: unreadRow.unread_count || 0
        });
    } catch (err) {
        console.error('Error in getNotifications:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

// ── MARK NOTIFICATION AS READ ──
exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE notifications SET is_read = 1 WHERE notification_id = ?', [id]);
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error('Error in markNotificationRead:', err);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
};

// ── SYNC DELIVERED ORDERS (Safe scan to catch any eligible delivered orders that don't have a case) ──
exports.syncDeliveredOrders = async (req, res) => {
    try {
        const [deliveredOrders] = await db.query(`
            SELECT order_id FROM orders 
            WHERE order_status = 'delivered' 
              AND order_source = 'lead' 
              AND (dealer_id IS NULL)
              AND order_id NOT IN (SELECT order_id FROM customer_support_cases)
            LIMIT 50
        `);

        let createdCount = 0;
        for (const o of deliveredOrders) {
            try {
                const result = await customerSupportService.handleOrderDelivered(o.order_id);
                if (result && result.success && !result.alreadyExists) {
                    createdCount++;
                }
            } catch (err) {
                console.warn(`[Sync warn for order #${o.order_id}]:`, err.message);
            }
        }

        res.json({
            success: true,
            message: `Scanned delivered orders. Created ${createdCount} new support cases.`,
            created_count: createdCount
        });
    } catch (err) {
        console.error('Error in syncDeliveredOrders:', err);
        res.status(500).json({ success: false, message: 'Failed to sync delivered orders' });
    }
};

// ── GET SETTINGS & STAFF ROSTER ──
exports.getSettings = async (req, res) => {
    try {
        // Fetch active support staff
        const [staff] = await db.query(`
            SELECT u.user_id, u.name, u.email, u.phone, u.status, r.name as role_name, d.name as department_name,
                   (SELECT COUNT(*) FROM customer_support_cases WHERE assigned_to = u.user_id AND status != 'completed') as active_cases_count
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.department_id = 19 
               OR u.role_id IN (36, 37, 38)
               OR r.name LIKE '%support%'
            ORDER BY u.name ASC
        `);

        const [[caseCounts]] = await db.query(`
            SELECT 
                COUNT(*) as total_cases,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_cases,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_cases
            FROM customer_support_cases
        `);

        const [[fuCounts]] = await db.query(`
            SELECT 
                COUNT(*) as total_followups,
                SUM(CASE WHEN status = 'UPCOMING' THEN 1 ELSE 0 END) as upcoming_followups,
                SUM(CASE WHEN status = 'DUE' THEN 1 ELSE 0 END) as due_followups,
                SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END) as overdue_followups,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_followups
            FROM customer_support_followups
        `);

        res.json({
            success: true,
            settings: {
                followup_interval_days: 30,
                auto_assignment: 'round_robin',
                b2c_criteria: "order_source = 'lead' AND dealer_id IS NULL AND purchase_source = 'SGB Direct'",
                b2b_excluded: true,
                idempotency_enforced: true,
                photo_storage: 'diskStorage (/uploads)',
                photo_max_size_mb: 10,
                notification_channels: ['in_app', 'fcm_push']
            },
            staff,
            metrics: {
                cases: caseCounts,
                followups: fuCounts
            }
        });
    } catch (err) {
        console.error('Error in getSettings:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
};

// ── LOOKUP CUSTOMER / ORDERS BY PHONE ──
exports.lookupCustomer = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        const phonePattern = `%${cleanPhone.slice(-10)}%`;

        // 1. Search in orders
        const [orders] = await db.query(`
            SELECT o.order_id, o.customer_name, o.phone, o.total_amount, o.order_status, o.created_at,
                   o.address, o.city, o.state, o.pincode, o.purchase_source,
                   (SELECT GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ')
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE oi.order_id = o.order_id) as items_summary,
                   (SELECT case_id FROM customer_support_cases WHERE order_id = o.order_id LIMIT 1) as existing_case_id,
                   (SELECT case_number FROM customer_support_cases WHERE order_id = o.order_id LIMIT 1) as existing_case_number
            FROM orders o
            WHERE o.phone LIKE ?
            ORDER BY o.created_at DESC
            LIMIT 5
        `, [phonePattern]);

        // 2. Search in leads
        const [leads] = await db.query(`
            SELECT lead_id, customer_name as name, phone_number, address, city, state, pincode, current_crop
            FROM leads
            WHERE phone_number LIKE ?
            LIMIT 1
        `, [phonePattern]);

        res.json({
            success: true,
            found: orders.length > 0 || leads.length > 0,
            orders,
            lead: leads[0] || null
        });
    } catch (err) {
        console.error('Error in lookupCustomer:', err);
        res.status(500).json({ success: false, message: 'Failed to lookup customer' });
    }
};

// ── CREATE MANUAL SUPPORT CASE ──
exports.createManualCase = async (req, res) => {
    try {
        const {
            customer_phone,
            customer_name,
            order_id,
            manual_order_number,
            product_summary,
            delivery_date,
            address,
            city,
            notes
        } = req.body;

        if (!customer_phone || !customer_phone.trim()) {
            return res.status(400).json({ success: false, message: 'Customer mobile number is required' });
        }
        if (!customer_name || !customer_name.trim()) {
            return res.status(400).json({ success: false, message: 'Customer name is required' });
        }

        const cleanPhone = customer_phone.trim();
        const parsedOrderId = order_id ? parseInt(order_id, 10) : null;

        // If order_id is provided, check if a case already exists
        if (parsedOrderId) {
            const [existing] = await db.query(
                'SELECT case_id, case_number, status FROM customer_support_cases WHERE order_id = ?',
                [parsedOrderId]
            );
            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `A support case already exists for Order #${parsedOrderId} (${existing[0].case_number}).`,
                    existing_case_id: existing[0].case_id
                });
            }
        }

        // Generate case number
        const year = new Date().getFullYear();
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const refNum = parsedOrderId || randSuffix;
        const caseNumber = `CS-${year}-${String(refNum).padStart(5, '0')}`;

        // Look up lead_id if exists
        let leadId = null;
        if (parsedOrderId) {
            const [[orderRow]] = await db.query('SELECT lead_id FROM orders WHERE order_id = ?', [parsedOrderId]);
            if (orderRow && orderRow.lead_id) leadId = orderRow.lead_id;
        }
        if (!leadId) {
            const [leadRows] = await db.query('SELECT lead_id FROM leads WHERE phone_number LIKE ? LIMIT 1', [`%${cleanPhone.slice(-10)}%`]);
            if (leadRows.length > 0) leadId = leadRows[0].lead_id;
        }

        const assignedTo = req.user.id || req.user.user_id;
        const deliveryDt = delivery_date ? new Date(delivery_date) : new Date();

        const [insertRes] = await db.query(`
            INSERT INTO customer_support_cases 
            (case_number, order_id, manual_order_number, lead_id, customer_name, customer_phone, product_summary, assigned_to, status, delivery_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'delivered', ?)
        `, [
            caseNumber,
            parsedOrderId || null,
            manual_order_number || (parsedOrderId ? `#${parsedOrderId}` : null),
            leadId,
            customer_name.trim(),
            cleanPhone,
            product_summary || 'Manual Order Equipment & Supplies',
            assignedTo,
            deliveryDt
        ]);

        const newCaseId = insertRes.insertId;

        // If initial notes provided, save to notes
        if (notes && notes.trim()) {
            await db.query(`
                INSERT INTO customer_support_notes (case_id, note, created_by)
                VALUES (?, ?, ?)
            `, [newCaseId, `[Case Created Manually]: ${notes.trim()}`, assignedTo]);
        }

        res.json({
            success: true,
            message: 'Manual customer support case created successfully',
            case_id: newCaseId,
            case_number: caseNumber
        });

    } catch (err) {
        console.error('Error in createManualCase:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to create manual support case' });
    }
};



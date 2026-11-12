const db = require('../config/db');
const customerSupportService = require('../services/customer_support.service');
const storageService = require('../services/storage.service');
const path = require('path');
const fs = require('fs');

const CUSTOMER_SUPPORT_R2_FOLDER = 'customer_support';

/**
 * Persists an uploaded image or video from Customer Support into Cloudflare R2
 * under sgb-crm-media/customer_support/ and falls back to local disk only if R2 fails.
 */
async function persistCustomerSupportMediaFile(file, keyPrefix = '') {
    const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
    const rawBase = path.basename(file.originalname || file.filename || 'media', ext)
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'media';
    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1E6)}`;
    const objectFileName = `${keyPrefix}${uniqueId}-${rawBase}${ext}`;
    const r2Key = `${CUSTOMER_SUPPORT_R2_FOLDER}/${objectFileName}`;
    const publicMediaUrl = `/api/media/${r2Key}`;

    try {
        const body = file.buffer ? file.buffer : fs.createReadStream(file.path);
        await storageService.uploadObject({
            key: r2Key,
            body,
            contentType: file.mimetype || 'application/octet-stream',
            metadata: {
                module: 'customer_support',
                original_name: encodeURIComponent(file.originalname || objectFileName)
            }
        });

        // Clean up temporary multer file once stored safely in R2
        if (file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (unlinkErr) {
                console.warn('Temp upload cleanup warn:', unlinkErr.message);
            }
        }

        return { fileUrl: publicMediaUrl, r2Key, storage: 'r2' };
    } catch (r2Err) {
        console.warn(`[CUSTOMER SUPPORT R2 WARN] Upload failed for '${r2Key}', preserving local fallback:`, r2Err.message);
        const fallbackDir = path.join(__dirname, '../../uploads', CUSTOMER_SUPPORT_R2_FOLDER);
        if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
        }
        const fallbackPath = path.join(fallbackDir, objectFileName);
        if (file.buffer) {
            fs.writeFileSync(fallbackPath, file.buffer);
        } else if (file.path && fs.existsSync(file.path)) {
            fs.renameSync(file.path, fallbackPath);
        }
        return { fileUrl: publicMediaUrl, r2Key, storage: 'local_fallback' };
    }
}

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
                   (SELECT scheduled_date FROM customer_support_followups WHERE case_id = c.case_id AND status != 'COMPLETED' ORDER BY scheduled_date ASC LIMIT 1) as followup_date,
                   (SELECT status FROM customer_support_followups WHERE case_id = c.case_id AND status != 'COMPLETED' ORDER BY scheduled_date ASC LIMIT 1) as followup_status
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
            remarks,
            scheduled_date,
            preferred_time_slot
        } = req.body;

        if (!call_outcome) {
            return res.status(400).json({ success: false, message: 'Call outcome is required' });
        }

        const validOutcomes = ['answered', 'not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required', 'no_assistance_needed'];
        if (!validOutcomes.includes(call_outcome)) {
            return res.status(400).json({ success: false, message: 'Invalid call outcome' });
        }

        // Fetch case details for customer & order context
        const [cases] = await db.query('SELECT * FROM customer_support_cases WHERE case_id = ?', [id]);
        if (cases.length === 0) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }
        const supportCase = cases[0];

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
        } else if (['not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required'].includes(call_outcome)) {
            newCaseStatus = 'pending_contact';
        } else if (call_outcome === 'no_assistance_needed') {
            newCaseStatus = 'contacted';
        }

        await db.query(`
            UPDATE customer_support_cases 
            SET status = ?, installation_status = COALESCE(?, installation_status), initial_call_date = COALESCE(initial_call_date, NOW())
            WHERE case_id = ?
        `, [newCaseStatus, installation_status || null, id]);

        // If customer was unreachable or callback required and scheduled_date is provided, create/update follow-up
        let followupId = null;
        const isUnreachable = ['not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required'].includes(call_outcome);
        if (scheduled_date && isUnreachable) {
            const scheduledDateObj = new Date(scheduled_date);
            const todayObj = new Date(new Date().toDateString());
            const fuStatus = (scheduledDateObj <= todayObj) ? 'DUE' : 'UPCOMING';

            const combinedRemarks = [
                preferred_time_slot ? `Slot: ${preferred_time_slot}` : '',
                remarks ? remarks.trim() : ''
            ].filter(Boolean).join(' | ');

            const [fuResult] = await db.query(`
                INSERT INTO customer_support_followups
                (case_id, order_id, customer_name, customer_phone, assigned_to, followup_type, scheduled_date, status, remarks)
                VALUES (?, ?, ?, ?, ?, 'CALLBACK', ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    scheduled_date = VALUES(scheduled_date),
                    status = VALUES(status),
                    remarks = VALUES(remarks),
                    assigned_to = VALUES(assigned_to),
                    notification_sent = 0,
                    updated_at = NOW()
            `, [
                id,
                supportCase.order_id,
                supportCase.customer_name,
                supportCase.customer_phone,
                supportCase.assigned_to || req.user.id,
                scheduled_date,
                fuStatus,
                combinedRemarks || `Follow-up after ${call_outcome.replace(/_/g, ' ')}`
            ]);

            followupId = fuResult.insertId || null;

            // In-app notification for executive
            const executiveId = supportCase.assigned_to || req.user.id;
            const notifTitle = 'Follow-Up Call Scheduled';
            const notifMsg = `Follow-up call for Customer ${supportCase.customer_name} (Order #${supportCase.order_id || 'Manual'}) scheduled for ${new Date(scheduled_date).toLocaleDateString('en-IN')}${preferred_time_slot ? ' [' + preferred_time_slot + ']' : ''}. Reason: ${call_outcome.replace(/_/g, ' ')}.`;
            const notifLink = `modules/customer_support/customer_details.html?case_id=${id}`;

            try {
                await db.query(`
                    INSERT INTO notifications (order_id, user_id, title, message, type, link, data, status)
                    VALUES (?, ?, ?, ?, 'customer_support', ?, ?, 'unread')
                `, [
                    supportCase.order_id || null,
                    executiveId,
                    notifTitle,
                    notifMsg,
                    notifLink,
                    JSON.stringify({ caseId: String(id), followupId: String(followupId), scheduledDate: scheduled_date })
                ]);
            } catch (notifErr) {
                console.warn('Failed to insert followup notification:', notifErr.message);
            }
        }

        // Auto note
        const outcomeLabels = {
            answered: 'Customer Answered',
            not_answered: 'Customer Did Not Answer',
            switched_off: 'Phone Switched Off',
            not_reachable: 'Not Reachable / Network Issue',
            busy: 'Line Busy / Call Declined',
            callback_required: 'Customer Requested Callback',
            no_assistance_needed: 'Customer Does Not Need Assistance'
        };
        const outcomeText = outcomeLabels[call_outcome] || call_outcome;

        let noteText = `Call logged [${call_type}]: Outcome was "${outcomeText}".`;
        if (scheduled_date) {
            noteText += ` Follow-up scheduled for ${scheduled_date}${preferred_time_slot ? ' (' + preferred_time_slot + ')' : ''}.`;
        }
        if (installation_status) {
            noteText += ` Installation status: ${installation_status.replace(/_/g, ' ')}.`;
        }
        if (remarks) {
            noteText += ` Remarks: ${remarks}`;
        }

        await db.query(`
            INSERT INTO customer_support_notes (case_id, call_id, note, created_by)
            VALUES (?, ?, ?, ?)
        `, [
            id,
            callId,
            noteText,
            req.user.id || req.user.user_id
        ]);

        res.json({
            success: true,
            message: scheduled_date ? `Call logged & follow-up scheduled for ${scheduled_date}` : 'Call recorded successfully',
            call_id: callId,
            followup_id: followupId,
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
            const { fileUrl } = await persistCustomerSupportMediaFile(file, `case_${id}_`);
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
        if (['not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required'].includes(call_outcome)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot mark support complete while customer is unreachable. Please schedule a follow-up or retain case open.'
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
        const { status, search, page = 1, limit = 20, type } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Process due follow-ups to ensure status is up to date
        await customerSupportService.processDueFollowups().catch(e => console.warn(e.message));

        let whereClauses = [];
        let params = [];

        // 30-Day Product Follow-ups display only completed cases with 30_DAY_PRODUCT_CHECK
        if (type && type !== '30_DAY_PRODUCT_CHECK') {
            whereClauses.push('f.followup_type = ?');
            params.push(type);
        } else {
            whereClauses.push('f.followup_type = "30_DAY_PRODUCT_CHECK"');
            whereClauses.push('c.status = "completed"');
        }

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
                photo_storage: `Cloudflare R2 (${storageService.defaultBucket}/${CUSTOMER_SUPPORT_R2_FOLDER}/)`,
                photo_max_size_mb: 60,
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
        if (cleanPhone.length < 4) {
            return res.status(400).json({ success: false, message: 'Enter at least 4 phone digits to lookup customer' });
        }
        const phonePattern = `%${cleanPhone.slice(-10)}%`;

        // 1. Search in orders (including village/sub_district/district where available)
        const [rawOrders] = await db.query(`
            SELECT o.order_id, o.customer_name, o.phone, o.total_amount, o.order_status, o.created_at,
                   o.address, o.village, o.sub_district, o.district, o.city, o.state, o.pincode,
                   o.purchase_source, o.order_source, o.dealer_id,
                   (SELECT GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ')
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE oi.order_id = o.order_id) as items_summary,
                   (SELECT GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ')
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE oi.order_id = o.order_id) as product_names,
                   (SELECT case_id FROM customer_support_cases WHERE order_id = o.order_id LIMIT 1) as existing_case_id,
                   (SELECT case_number FROM customer_support_cases WHERE order_id = o.order_id LIMIT 1) as existing_case_number
            FROM orders o
            WHERE o.phone LIKE ?
            ORDER BY o.created_at DESC
            LIMIT 8
        `, [phonePattern]);

        const formatAddr = (row) => [row.address, row.village, row.sub_district, row.city || row.district, row.state, row.pincode]
            .map(v => (v || '').trim())
            .filter(Boolean)
            .filter((v, idx, arr) => arr.indexOf(v) === idx)
            .join(', ');

        const orders = rawOrders.map(o => ({
            ...o,
            product_name: o.product_names || o.items_summary || '',
            full_address: formatAddr(o),
            is_b2b_dealer: Boolean(o.dealer_id || o.purchase_source === 'Dealer' || o.order_source === 'dealer')
        }));

        // 2. Search in leads
        const [leads] = await db.query(`
            SELECT lead_id, customer_name as name, phone_number, address, city, state, pincode, current_crop
            FROM leads
            WHERE phone_number LIKE ?
            LIMIT 1
        `, [phonePattern]);

        // 3. Check latest prior job cards for machinery auto-suggestion
        const [pastJobCards] = await db.query(`
            SELECT job_card_id, job_card_number, customer_name, customer_phone, customer_address,
                   machine_make_model, product_summary, serial_vin_number, hours_run, status
            FROM customer_support_job_cards
            WHERE customer_phone LIKE ?
            ORDER BY created_at DESC
            LIMIT 5
        `, [phonePattern]);

        // 4. Check support cases for fallback customer info
        const [supportCases] = await db.query(`
            SELECT case_id, case_number, customer_name, customer_phone, product_summary, order_id
            FROM customer_support_cases
            WHERE customer_phone LIKE ?
            ORDER BY created_at DESC
            LIMIT 3
        `, [phonePattern]);

        const lead = leads[0] || null;
        const latestOrder = orders[0] || null;
        const latestCard = pastJobCards[0] || null;
        const latestCase = supportCases[0] || null;

        const resolvedCustomer = (lead || latestOrder || latestCard || latestCase) ? {
            name: (latestOrder && latestOrder.customer_name) || (lead && lead.name) || (latestCard && latestCard.customer_name) || (latestCase && latestCase.customer_name) || '',
            phone: (latestOrder && latestOrder.phone) || (lead && lead.phone_number) || (latestCard && latestCard.customer_phone) || (latestCase && latestCase.customer_phone) || phone.trim(),
            address: (latestOrder && latestOrder.full_address) || (lead ? formatAddr(lead) : '') || (latestCard && latestCard.customer_address) || '',
            machine_make_model: (latestOrder && latestOrder.product_names) || (latestCard && (latestCard.machine_make_model || latestCard.product_summary)) || (latestCase && latestCase.product_summary) || '',
            serial_vin_number: (latestCard && latestCard.serial_vin_number) || ''
        } : null;

        res.json({
            success: true,
            found: Boolean(resolvedCustomer),
            customer: resolvedCustomer,
            orders,
            lead,
            past_job_cards: pastJobCards,
            support_cases: supportCases
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

// ============================================================
// ── JOB CARDS MANAGEMENT ──
// ============================================================

const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

function toMysqlDate(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMysqlDateTime(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    const str = String(val).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str} 00:00:00`;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseJsonField(val, fallback = []) {
    if (val === undefined || val === null || val === '') return fallback;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }
    return fallback;
}

function normalizeAndValidateParts(rawParts) {
    const items = parseJsonField(rawParts, []);
    const normalized = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const partName = (item.part_name || '').trim();
        const partNumber = (item.part_number || '').trim();
        const hasAnyInput = partName || partNumber || (item.remarks && item.remarks.trim());
        if (!hasAnyInput) continue;
        if (!partName) {
            return { error: `Part row #${i + 1}: Part description is required` };
        }

        const qty = parseFloat(item.quantity !== undefined && item.quantity !== '' ? item.quantity : 1);
        const unitCost = parseFloat(item.unit_cost !== undefined && item.unit_cost !== '' ? item.unit_cost : 0);
        const isFoc = Boolean(item.is_foc === true || item.is_foc === 1 || item.is_foc === '1' || item.is_foc === 'true');

        if (isNaN(qty) || qty <= 0) {
            return { error: `Part "${partName}": Quantity must be greater than zero` };
        }
        if (isNaN(unitCost) || unitCost < 0) {
            return { error: `Part "${partName}": Unit price cannot be negative` };
        }

        const totalCost = isFoc ? 0.00 : round2(qty * unitCost);
        normalized.push({
            part_name: partName,
            part_number: partNumber || null,
            quantity: round2(qty),
            unit_cost: round2(unitCost),
            is_foc: isFoc ? 1 : 0,
            total_cost: totalCost,
            remarks: item.remarks ? item.remarks.trim() : null
        });
    }

    return { items: normalized };
}

function normalizeAndValidateLabour(rawLabour) {
    const items = parseJsonField(rawLabour, []);
    const normalized = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const desc = (item.labour_description || item.description || '').trim();
        const rawCharge = item.amount !== undefined && item.amount !== ''
            ? item.amount
            : (item.charge !== undefined && item.charge !== ''
                ? item.charge
                : (item.rate !== undefined && item.rate !== ''
                    ? item.rate
                    : (item.total_cost !== undefined && item.total_cost !== '' ? item.total_cost : 0)));
        const parsedCharge = parseFloat(rawCharge);
        const hasAnyInput = desc || (item.remarks && item.remarks.trim()) || (!isNaN(parsedCharge) && parsedCharge > 0);
        if (!hasAnyInput) continue;
        if (!desc) {
            return { error: `Labour row #${i + 1}: Labour description is required` };
        }

        if (isNaN(parsedCharge) || parsedCharge < 0) {
            return { error: `Labour "${desc}": Charge amount cannot be negative` };
        }

        // Labour is billed as a flat charge rather than hourly; keep DB hours column = 1.00 for schema compatibility
        const flatCharge = round2(parsedCharge);
        normalized.push({
            labour_description: desc,
            hours: 1,
            rate: flatCharge,
            total_cost: flatCharge,
            remarks: item.remarks ? item.remarks.trim() : null
        });
    }

    return { items: normalized };
}

function calculateAndValidateFinancials(parts, labour, body) {
    const partsTotal = round2(parts.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0));
    const labourTotal = round2(labour.reduce((sum, l) => sum + (parseFloat(l.total_cost) || 0), 0));
    const subtotal = round2(partsTotal + labourTotal);

    const discount = parseFloat(body.discount_amount !== undefined && body.discount_amount !== '' ? body.discount_amount : 0);
    if (isNaN(discount) || discount < 0) {
        return { error: 'Discount cannot be negative' };
    }
    if (discount > subtotal + 0.01) {
        return { error: 'Discount cannot exceed combined Parts Total and Labour Total' };
    }

    const taxableAmount = round2(Math.max(0, subtotal - discount));
    const taxPercent = parseFloat(body.tax_percent !== undefined && body.tax_percent !== '' ? body.tax_percent : 0);
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return { error: 'Tax percentage must be between 0 and 100' };
    }

    let taxAmount;
    if (body.tax_amount !== undefined && body.tax_amount !== null && body.tax_amount !== '') {
        taxAmount = parseFloat(body.tax_amount);
        if (isNaN(taxAmount) || taxAmount < 0) {
            return { error: 'Applicable taxes cannot be negative' };
        }
    } else {
        taxAmount = round2((taxableAmount * taxPercent) / 100);
    }
    taxAmount = round2(taxAmount);

    const rawShipping = body.shipping_charge !== undefined && body.shipping_charge !== ''
        ? body.shipping_charge
        : (body.shipping_charges !== undefined && body.shipping_charges !== ''
            ? body.shipping_charges
            : (body.delivery_charge !== undefined && body.delivery_charge !== '' ? body.delivery_charge : 0));
    let shippingCharge = parseFloat(rawShipping);
    if (isNaN(shippingCharge) || shippingCharge < 0) {
        return { error: 'Shipping / delivery charge cannot be negative' };
    }
    shippingCharge = round2(shippingCharge);

    const grandTotal = round2(Math.max(0, taxableAmount + taxAmount + shippingCharge));

    const amountPaid = parseFloat(body.amount_paid !== undefined && body.amount_paid !== '' ? body.amount_paid : 0);
    if (isNaN(amountPaid) || amountPaid < 0) {
        return { error: 'Amount paid cannot be negative' };
    }
    if (grandTotal > 0 && amountPaid > grandTotal + 0.01) {
        return { error: 'Amount paid cannot exceed Grand Total' };
    }

    const clampedPaid = round2(Math.min(amountPaid, grandTotal));
    const balanceAmount = round2(Math.max(0, grandTotal - clampedPaid));

    let derivedPaymentStatus = 'Unpaid';
    if (grandTotal === 0) {
        const requested = (body.payment_status || '').trim();
        derivedPaymentStatus = ['Paid', 'Unpaid'].includes(requested) ? requested : 'Paid';
    } else if (clampedPaid >= grandTotal - 0.01) {
        derivedPaymentStatus = 'Paid';
    } else if (clampedPaid > 0) {
        derivedPaymentStatus = 'Partially Paid';
    }

    const validModes = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'FOC / Warranty', ''];
    const rawMode = (body.payment_mode || '').trim();
    const paymentMode = validModes.includes(rawMode) ? (rawMode || null) : rawMode.slice(0, 50);

    return {
        financials: {
            parts_total: partsTotal,
            labour_total: labourTotal,
            service_cost: labourTotal,
            discount_amount: round2(discount),
            taxable_amount: taxableAmount,
            tax_percent: round2(taxPercent),
            tax_amount: taxAmount,
            shipping_charge: shippingCharge,
            grand_total: grandTotal,
            amount_paid: clampedPaid,
            balance_amount: balanceAmount,
            payment_status: derivedPaymentStatus,
            payment_mode: paymentMode
        }
    };
}

function normalizePhotoType(rawType) {
    const t = (rawType || '').trim();
    if (t === 'BEFORE_WORK' || t === 'before') return 'BEFORE_WORK';
    if (t === 'AFTER_WORK' || t === 'after') return 'AFTER_WORK';
    if (t === 'issue' || t === 'other') return t;
    return 'BEFORE_WORK';
}

async function generateNextJobCardNumber(conn = db) {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `JC-${todayStr}-`;
    const [rows] = await conn.query(
        'SELECT job_card_number FROM customer_support_job_cards WHERE job_card_number LIKE ? ORDER BY job_card_number DESC LIMIT 1',
        [`${prefix}%`]
    );
    let nextSeq = 1;
    if (rows.length > 0 && rows[0].job_card_number) {
        const suffix = rows[0].job_card_number.slice(prefix.length);
        const parsed = parseInt(suffix, 10);
        if (!isNaN(parsed) && parsed >= 1) nextSeq = parsed + 1;
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

async function saveJobCardUploadedPhotos(conn, jobCardId, reqFiles, fallbackType, userId, captionText = null) {
    const inserted = [];
    const groups = [];

    if (Array.isArray(reqFiles)) {
        groups.push({ files: reqFiles, type: normalizePhotoType(fallbackType) });
    } else if (reqFiles && typeof reqFiles === 'object') {
        if (Array.isArray(reqFiles.before_photos) && reqFiles.before_photos.length > 0) {
            groups.push({ files: reqFiles.before_photos, type: 'BEFORE_WORK' });
        }
        if (Array.isArray(reqFiles.after_photos) && reqFiles.after_photos.length > 0) {
            groups.push({ files: reqFiles.after_photos, type: 'AFTER_WORK' });
        }
        if (Array.isArray(reqFiles.photos) && reqFiles.photos.length > 0) {
            groups.push({ files: reqFiles.photos, type: normalizePhotoType(fallbackType) });
        }
    }

    for (const grp of groups) {
        const typePrefix = grp.type.toLowerCase();
        for (const file of grp.files) {
            const { fileUrl } = await persistCustomerSupportMediaFile(file, `jc_${jobCardId}_${typePrefix}_`);
            const [res] = await conn.query(`
                INSERT INTO customer_support_job_card_photos
                (job_card_id, photo_type, file_url, file_name, file_size, caption, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [jobCardId, grp.type, fileUrl, file.originalname, file.size, captionText, userId]);
            inserted.push({
                photo_id: res.insertId,
                photo_type: grp.type,
                file_url: fileUrl,
                file_name: file.originalname
            });
        }
    }

    return inserted;
}

async function replaceJobCardPartsAndLabour(conn, jobCardId, parts, labour) {
    if (parts !== null) {
        await conn.query('DELETE FROM customer_support_job_card_parts WHERE job_card_id = ?', [jobCardId]);
        for (const p of parts) {
            await conn.query(`
                INSERT INTO customer_support_job_card_parts
                (job_card_id, part_name, part_number, quantity, unit_cost, is_foc, total_cost, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [jobCardId, p.part_name, p.part_number, p.quantity, p.unit_cost, p.is_foc, p.total_cost, p.remarks]);
        }
    }
    if (labour !== null) {
        await conn.query('DELETE FROM customer_support_job_card_labour WHERE job_card_id = ?', [jobCardId]);
        for (const l of labour) {
            await conn.query(`
                INSERT INTO customer_support_job_card_labour
                (job_card_id, labour_description, hours, rate, total_cost, remarks)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [jobCardId, l.labour_description, l.hours, l.rate, l.total_cost, l.remarks]);
        }
    }
}

async function resolveCurrentStaffUser(reqUser) {
    const userId = reqUser.id || reqUser.user_id;
    let name = reqUser.name || '';
    if (!name && userId) {
        const [[u]] = await db.query('SELECT name FROM users WHERE user_id = ?', [userId]);
        if (u && u.name) name = u.name;
    }
    return { userId, name: name || 'Support Staff' };
}

// ── GET JOB CARD INITIAL META (Next Number, Current Logged-In User, Date, Staff) ──
exports.getJobCardInitMeta = async (req, res) => {
    try {
        const currentStaff = await resolveCurrentStaffUser(req.user);
        const nextNumber = await generateNextJobCardNumber(db);
        const todayDate = new Date().toISOString().slice(0, 10);

        const [staffRows] = await db.query(`
            SELECT u.user_id, u.name, r.name as role_name, d.name as department_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.status = 'active'
              AND (
                  u.department_id = 19
                  OR LOWER(COALESCE(d.name, '')) LIKE '%customer support%'
                  OR u.role_id IN (36, 37, 38)
                  OR LOWER(COALESCE(r.name, '')) LIKE '%support%'
              )
            ORDER BY u.name ASC
        `);

        res.json({
            success: true,
            next_job_card_number: nextNumber,
            today_date: todayDate,
            current_user: {
                user_id: currentStaff.userId,
                name: currentStaff.name,
                role: req.user.role || ''
            },
            staff_list: staffRows
        });
    } catch (err) {
        console.error('Error in getJobCardInitMeta:', err);
        res.status(500).json({ success: false, message: 'Failed to load job card metadata' });
    }
};

// ── GET JOB CARDS (Paginated with tabs & filters including Draft) ──
exports.getJobCards = async (req, res) => {
    try {
        const {
            status,
            job_type,
            priority,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        let whereClauses = ['1=1'];
        let params = [];

        if (status && status !== 'all' && status !== 'All') {
            const normalizedStatus = status.toLowerCase().replace(/[-_]/g, ' ').trim();
            if (normalizedStatus === 'draft') {
                whereClauses.push("jc.status = 'Draft'");
            } else if (normalizedStatus === 'open') {
                whereClauses.push("jc.status = 'Open'");
            } else if (normalizedStatus === 'in progress') {
                whereClauses.push("jc.status = 'In Progress'");
            } else if (normalizedStatus === 'on hold') {
                whereClauses.push("jc.status = 'On Hold'");
            } else if (normalizedStatus === 'completed') {
                whereClauses.push("jc.status = 'Completed'");
            } else if (normalizedStatus === 'cancelled') {
                whereClauses.push("jc.status = 'Cancelled'");
            } else {
                whereClauses.push('jc.status = ?');
                params.push(status);
            }
        }

        if (job_type && job_type !== 'all' && job_type !== 'All') {
            whereClauses.push('jc.job_type = ?');
            params.push(job_type);
        }

        if (priority && priority !== 'all' && priority !== 'All') {
            whereClauses.push('jc.priority = ?');
            params.push(priority);
        }

        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            whereClauses.push(`(
                jc.job_card_number LIKE ? OR jc.customer_name LIKE ? OR jc.customer_phone LIKE ?
                OR jc.product_summary LIKE ? OR jc.machine_make_model LIKE ?
                OR jc.serial_vin_number LIKE ? OR jc.specific_complaint LIKE ?
                OR jc.issue_description LIKE ? OR CAST(jc.order_id AS CHAR) LIKE ?
            )`);
            params.push(q, q, q, q, q, q, q, q, q);
        }

        const whereSql = whereClauses.join(' AND ');

        const [[countRow]] = await db.query(`
            SELECT COUNT(*) as total
            FROM customer_support_job_cards jc
            WHERE ${whereSql}
        `, params);

        const [[statusCounts]] = await db.query(`
            SELECT 
                COUNT(*) as all_count,
                SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_count,
                SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_count,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
                SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END) as on_hold_count,
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_count
            FROM customer_support_job_cards
        `);

        const [jobCards] = await db.query(`
            SELECT jc.*,
                   COALESCE(jc.technician_name, u.name) as assigned_to_name,
                   creator.name as created_by_name,
                   (SELECT COUNT(*) FROM customer_support_job_card_photos WHERE job_card_id = jc.job_card_id) as photo_count,
                   (SELECT COUNT(*) FROM customer_support_job_card_parts WHERE job_card_id = jc.job_card_id) as part_count,
                   (SELECT COUNT(*) FROM customer_support_job_card_labour WHERE job_card_id = jc.job_card_id) as labour_count
            FROM customer_support_job_cards jc
            LEFT JOIN users u ON jc.assigned_to = u.user_id
            LEFT JOIN users creator ON jc.created_by = creator.user_id
            WHERE ${whereSql}
            ORDER BY jc.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit, 10), offset]);

        res.json({
            success: true,
            job_cards: jobCards,
            data: jobCards,
            counts: {
                all: statusCounts ? (statusCounts.all_count || 0) : 0,
                draft: statusCounts ? (statusCounts.draft_count || 0) : 0,
                open: statusCounts ? (statusCounts.open_count || 0) : 0,
                in_progress: statusCounts ? (statusCounts.in_progress_count || 0) : 0,
                on_hold: statusCounts ? (statusCounts.on_hold_count || 0) : 0,
                completed: statusCounts ? (statusCounts.completed_count || 0) : 0,
                cancelled: statusCounts ? (statusCounts.cancelled_count || 0) : 0
            },
            statusCounts: {
                all: statusCounts ? (statusCounts.all_count || 0) : 0,
                draft: statusCounts ? (statusCounts.draft_count || 0) : 0,
                open: statusCounts ? (statusCounts.open_count || 0) : 0,
                'in progress': statusCounts ? (statusCounts.in_progress_count || 0) : 0,
                'on hold': statusCounts ? (statusCounts.on_hold_count || 0) : 0,
                completed: statusCounts ? (statusCounts.completed_count || 0) : 0,
                cancelled: statusCounts ? (statusCounts.cancelled_count || 0) : 0
            },
            pagination: {
                total: countRow ? (countRow.total || 0) : 0,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                totalPages: Math.ceil((countRow ? countRow.total : 0) / parseInt(limit, 10)) || 1
            }
        });
    } catch (err) {
        console.error('Error in getJobCards:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch job cards' });
    }
};

// ── CREATE NEW JOB CARD (Supports Draft, Open, In Progress, On Hold + Full 10 Sections) ──
exports.createJobCard = async (req, res) => {
    try {
        const body = req.body || {};
        const requestedStatusRaw = (body.status || 'Open').trim();
        const allowedCreateStatuses = ['Draft', 'Open', 'In Progress', 'On Hold'];
        const targetStatus = allowedCreateStatuses.includes(requestedStatusRaw) ? requestedStatusRaw : 'Open';
        const isDraft = targetStatus === 'Draft';

        const customerName = (body.customer_name || '').trim();
        const customerPhone = (body.customer_phone || '').trim();
        const issueDesc = (body.issue_description || '').trim();
        const specificComplaint = (body.specific_complaint || '').trim();

        if (!isDraft) {
            if (!customerName) {
                return res.status(400).json({ success: false, message: 'Customer name is required' });
            }
            if (!customerPhone) {
                return res.status(400).json({ success: false, message: 'Customer phone number is required' });
            }
            if (!issueDesc && !specificComplaint) {
                return res.status(400).json({ success: false, message: 'Customer reported problem or specific complaint is required' });
            }
        } else {
            if (!customerName && !customerPhone && !issueDesc && !specificComplaint && !(body.machine_make_model || body.product_summary || '').trim()) {
                return res.status(400).json({ success: false, message: 'Enter at least customer info, machine, or complaint details to save a draft' });
            }
        }

        const parsedOrderId = body.order_id ? parseInt(body.order_id, 10) : null;
        const parsedCaseId = body.case_id ? parseInt(body.case_id, 10) : null;

        // Restriction check: Only eligible SGB Direct B2C purchases when linked to an order
        if (parsedOrderId) {
            const [[orderRow]] = await db.query(
                'SELECT order_id, purchase_source, order_source, dealer_id FROM orders WHERE order_id = ?',
                [parsedOrderId]
            );
            if (orderRow && (orderRow.dealer_id || orderRow.purchase_source === 'Dealer' || orderRow.order_source === 'dealer')) {
                return res.status(400).json({
                    success: false,
                    message: 'Job Cards can only be created for SGB Direct B2C purchases. B2B dealer orders are not eligible.'
                });
            }
        }

        // Duplicate prevention for non-draft active Job Cards
        const effectiveComplaint = issueDesc || specificComplaint;
        if (!isDraft && customerPhone && effectiveComplaint) {
            const [duplicateCheck] = await db.query(`
                SELECT job_card_id, job_card_number, status, issue_description, job_type
                FROM customer_support_job_cards
                WHERE customer_phone = ? AND status IN ('Open', 'In Progress', 'On Hold')
                  AND (
                    (? IS NOT NULL AND case_id = ?)
                    OR LOWER(TRIM(COALESCE(issue_description, ''))) = LOWER(TRIM(?))
                    OR (job_type = ? AND ? IS NOT NULL AND order_id = ?)
                  )
                LIMIT 1
            `, [
                customerPhone,
                parsedCaseId, parsedCaseId,
                effectiveComplaint,
                body.job_type || 'Service/Repair',
                parsedOrderId, parsedOrderId
            ]);

            if (duplicateCheck.length > 0) {
                const dup = duplicateCheck[0];
                return res.status(400).json({
                    success: false,
                    message: `An active Job Card (${dup.job_card_number}) is already ${dup.status} for this customer. Please open and edit that card instead.`,
                    existing_job_card_id: dup.job_card_id,
                    existing_job_card_number: dup.job_card_number
                });
            }
        }

        // Validate Parts, Labour, and Financials
        const partsValidation = normalizeAndValidateParts(body.parts);
        if (partsValidation.error) {
            return res.status(400).json({ success: false, message: partsValidation.error });
        }
        const labourValidation = normalizeAndValidateLabour(body.labour);
        if (labourValidation.error) {
            return res.status(400).json({ success: false, message: labourValidation.error });
        }
        const finValidation = calculateAndValidateFinancials(partsValidation.items, labourValidation.items, body);
        if (finValidation.error) {
            return res.status(400).json({ success: false, message: finValidation.error });
        }

        const currentStaff = await resolveCurrentStaffUser(req.user);
        const assignedUserId = body.assigned_to ? parseInt(body.assigned_to, 10) : currentStaff.userId;
        let technicianName = (body.technician_name || '').trim();
        if (!technicianName && assignedUserId) {
            if (assignedUserId === currentStaff.userId) {
                technicianName = currentStaff.name;
            } else {
                const [[techRow]] = await db.query('SELECT name FROM users WHERE user_id = ?', [assignedUserId]);
                if (techRow) technicianName = techRow.name;
            }
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const jobCardNumber = await generateNextJobCardNumber(connection);
            const machineMakeModel = (body.machine_make_model || body.product_summary || '').trim() || null;
            const promisedDate = toMysqlDate(body.promised_date || body.due_date);
            const jobCardDate = toMysqlDate(body.job_card_date) || new Date().toISOString().slice(0, 10);
            const additionalRemarks = (body.additional_remarks || body.notes || '').trim() || null;
            const initialDiagnosis = (body.initial_diagnosis || '').trim() || null;
            const signatureData = (body.customer_signature || '').trim() || null;
            const fin = finValidation.financials;

            const [insertRes] = await connection.query(`
                INSERT INTO customer_support_job_cards (
                    job_card_number, job_card_date, case_id, order_id,
                    customer_name, customer_phone, customer_address,
                    product_summary, machine_make_model, serial_vin_number, hours_run,
                    job_type, priority, status,
                    specific_complaint, issue_description, original_issue_description, work_required, initial_diagnosis, additional_observations,
                    before_work_condition, initial_inspection_remarks,
                    diagnosis, work_performed, parts_replaced_summary, repair_details, additional_remarks, notes,
                    final_machine_condition, work_completion_remarks,
                    parts_total, labour_total, service_cost, discount_amount, taxable_amount, tax_percent, tax_amount, shipping_charge,
                    grand_total, amount_paid, balance_amount, payment_status, payment_mode,
                    assigned_to, technician_name, due_date,
                    customer_feedback, technician_remarks, customer_signature, signature_date,
                    created_by
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?
                )
            `, [
                jobCardNumber, jobCardDate, parsedCaseId, parsedOrderId,
                customerName || 'Draft Customer', customerPhone || '', (body.customer_address || '').trim() || null,
                machineMakeModel, machineMakeModel, (body.serial_vin_number || '').trim() || null, (body.hours_run || '').trim() || null,
                body.job_type || 'Service/Repair', body.priority || 'Medium', targetStatus,
                specificComplaint || null, issueDesc || specificComplaint || null, issueDesc || specificComplaint || null,
                (body.work_required || '').trim() || null, initialDiagnosis, (body.additional_observations || '').trim() || null,
                (body.before_work_condition || '').trim() || null, (body.initial_inspection_remarks || '').trim() || null,
                (body.diagnosis || '').trim() || null, (body.work_performed || '').trim() || null,
                (body.parts_replaced_summary || '').trim() || null, (body.repair_details || '').trim() || null,
                additionalRemarks, additionalRemarks,
                (body.final_machine_condition || '').trim() || null, (body.work_completion_remarks || '').trim() || null,
                fin.parts_total, fin.labour_total, fin.service_cost, fin.discount_amount, fin.taxable_amount, fin.tax_percent, fin.tax_amount, fin.shipping_charge,
                fin.grand_total, fin.amount_paid, fin.balance_amount, fin.payment_status, fin.payment_mode,
                assignedUserId, technicianName || null, promisedDate,
                (body.customer_feedback || '').trim() || null, (body.technician_remarks || '').trim() || null,
                signatureData, signatureData ? new Date() : null,
                currentStaff.userId
            ]);

            const newJobCardId = insertRes.insertId;

            await replaceJobCardPartsAndLabour(connection, newJobCardId, partsValidation.items, labourValidation.items);

            await saveJobCardUploadedPhotos(
                connection,
                newJobCardId,
                req.files,
                body.photo_type || 'BEFORE_WORK',
                currentStaff.userId
            );

            await connection.query(`
                INSERT INTO customer_support_job_card_logs
                (job_card_id, action, previous_status, new_status, notes, performed_by)
                VALUES (?, ?, NULL, ?, ?, ?)
            `, [
                newJobCardId,
                isDraft ? 'DRAFT_CREATED' : 'CREATED',
                targetStatus,
                isDraft
                    ? `Draft saved by ${currentStaff.name}`
                    : `Job Card created (${targetStatus}) for ${body.job_type || 'Service/Repair'}: ${effectiveComplaint}`,
                currentStaff.userId
            ]);

            await connection.commit();

            res.json({
                success: true,
                message: isDraft ? 'Job Card saved as Draft' : 'Job Card created successfully',
                job_card_id: newJobCardId,
                job_card_number: jobCardNumber,
                status: targetStatus
            });
        } catch (trxErr) {
            await connection.rollback();
            throw trxErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error in createJobCard:', err);
        res.status(500).json({ success: false, message: 'Failed to create job card' });
    }
};

// ── GET SINGLE JOB CARD DETAILS ──
exports.getJobCardDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT jc.*,
                   COALESCE(jc.technician_name, u.name) as assigned_to_name,
                   u.email as assigned_to_email, u.phone as assigned_to_phone,
                   creator.name as created_by_name,
                   completer.name as completed_by_user_name,
                   c.case_number, c.status as case_status,
                   o.total_amount as order_total_amount, o.order_status, o.address as order_address
            FROM customer_support_job_cards jc
            LEFT JOIN users u ON jc.assigned_to = u.user_id
            LEFT JOIN users creator ON jc.created_by = creator.user_id
            LEFT JOIN users completer ON jc.completed_by = completer.user_id
            LEFT JOIN customer_support_cases c ON jc.case_id = c.case_id
            LEFT JOIN orders o ON jc.order_id = o.order_id
            WHERE jc.job_card_id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }

        const raw = rows[0];
        const jobCard = {
            ...raw,
            promised_date: raw.due_date,
            machine_make_model: raw.machine_make_model || raw.product_summary || '',
            job_card_date: raw.job_card_date || (raw.created_at ? new Date(raw.created_at).toISOString().slice(0, 10) : null),
            completed_by_name: raw.completed_by_name || raw.completed_by_user_name || null
        };

        const [parts] = await db.query(`
            SELECT * FROM customer_support_job_card_parts
            WHERE job_card_id = ?
            ORDER BY part_id ASC
        `, [id]);

        const [labour] = await db.query(`
            SELECT * FROM customer_support_job_card_labour
            WHERE job_card_id = ?
            ORDER BY labour_id ASC
        `, [id]);

        const [photos] = await db.query(`
            SELECT p.*, u.name as uploaded_by_name
            FROM customer_support_job_card_photos p
            LEFT JOIN users u ON p.uploaded_by = u.user_id
            WHERE p.job_card_id = ?
            ORDER BY p.created_at ASC
        `, [id]);

        const [logs] = await db.query(`
            SELECT l.*, u.name as performed_by_name
            FROM customer_support_job_card_logs l
            LEFT JOIN users u ON l.performed_by = u.user_id
            WHERE l.job_card_id = ?
            ORDER BY l.created_at ASC
        `, [id]);

        // Separate Before Work and After Work photos strictly
        const beforePhotos = photos.filter(p => ['BEFORE_WORK', 'before', 'issue'].includes(p.photo_type));
        const afterPhotos = photos.filter(p => ['AFTER_WORK', 'after'].includes(p.photo_type));
        const otherPhotos = photos.filter(p => !['BEFORE_WORK', 'before', 'issue', 'AFTER_WORK', 'after'].includes(p.photo_type));

        const partsTotal = round2(parts.reduce((sum, p) => sum + (p.is_foc ? 0 : (parseFloat(p.total_cost) || 0)), 0));
        const labourTotal = round2(
            labour.length > 0
                ? labour.reduce((sum, l) => sum + (parseFloat(l.total_cost) || 0), 0)
                : (parseFloat(jobCard.labour_total) || parseFloat(jobCard.service_cost) || 0)
        );
        const discountAmount = round2(parseFloat(jobCard.discount_amount) || 0);
        const taxableAmount = round2(Math.max(0, partsTotal + labourTotal - discountAmount));
        const taxAmount = round2(parseFloat(jobCard.tax_amount) || 0);
        const shippingCharge = round2(parseFloat(jobCard.shipping_charge) || 0);
        const grandTotal = round2(Math.max(0, taxableAmount + taxAmount + shippingCharge));
        const amountPaid = round2(parseFloat(jobCard.amount_paid) || 0);
        const balanceAmount = round2(Math.max(0, grandTotal - amountPaid));

        res.json({
            success: true,
            job_card: jobCard,
            parts,
            labour,
            photos,
            before_photos: beforePhotos,
            after_photos: afterPhotos,
            other_photos: otherPhotos,
            logs,
            parts_total: partsTotal,
            labour_total: labourTotal,
            grand_total: grandTotal,
            financials: {
                parts_total: partsTotal,
                labour_total: labourTotal,
                discount_amount: discountAmount,
                taxable_amount: taxableAmount,
                tax_percent: round2(parseFloat(jobCard.tax_percent) || 0),
                tax_amount: taxAmount,
                shipping_charge: shippingCharge,
                grand_total: grandTotal,
                amount_paid: amountPaid,
                balance_amount: balanceAmount,
                payment_status: jobCard.payment_status || 'Unpaid',
                payment_mode: jobCard.payment_mode || ''
            }
        });
    } catch (err) {
        console.error('Error in getJobCardDetails:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch job card details' });
    }
};

// ── UPDATE JOB CARD (Draft, Resume, Edit, Save Work In Progress) ──
exports.updateJobCard = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const [[existing]] = await db.query('SELECT * FROM customer_support_job_cards WHERE job_card_id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }
        if (existing.status === 'Completed' || existing.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: `Cannot edit a Job Card that is already ${existing.status}` });
        }

        const requestedStatus = (body.status || existing.status).trim();
        const allowedEditStatuses = ['Draft', 'Open', 'In Progress', 'On Hold'];
        if (!allowedEditStatuses.includes(requestedStatus)) {
            return res.status(400).json({ success: false, message: 'Use Complete or Cancel actions to finalize a Job Card' });
        }

        const customerName = (body.customer_name !== undefined ? body.customer_name : existing.customer_name || '').trim();
        const customerPhone = (body.customer_phone !== undefined ? body.customer_phone : existing.customer_phone || '').trim();
        const issueDesc = (body.issue_description !== undefined ? body.issue_description : existing.issue_description || '').trim();
        const specificComplaint = (body.specific_complaint !== undefined ? body.specific_complaint : existing.specific_complaint || '').trim();

        if (requestedStatus !== 'Draft') {
            if (!customerName) return res.status(400).json({ success: false, message: 'Customer name is required' });
            if (!customerPhone) return res.status(400).json({ success: false, message: 'Customer phone number is required' });
            if (!issueDesc && !specificComplaint) {
                return res.status(400).json({ success: false, message: 'Customer reported problem or specific complaint is required' });
            }
        }

        // Load existing child rows if parts/labour were omitted from payload
        let nextParts = null;
        if (body.parts !== undefined) {
            const pVal = normalizeAndValidateParts(body.parts);
            if (pVal.error) return res.status(400).json({ success: false, message: pVal.error });
            nextParts = pVal.items;
        }
        let nextLabour = null;
        if (body.labour !== undefined) {
            const lVal = normalizeAndValidateLabour(body.labour);
            if (lVal.error) return res.status(400).json({ success: false, message: lVal.error });
            nextLabour = lVal.items;
        }

        const partsForCalc = nextParts !== null
            ? nextParts
            : (await db.query('SELECT * FROM customer_support_job_card_parts WHERE job_card_id = ?', [id]))[0];
        const labourForCalc = nextLabour !== null
            ? nextLabour
            : (await db.query('SELECT * FROM customer_support_job_card_labour WHERE job_card_id = ?', [id]))[0];

        const finValidation = calculateAndValidateFinancials(partsForCalc, labourForCalc, {
            discount_amount: body.discount_amount !== undefined ? body.discount_amount : existing.discount_amount,
            tax_percent: body.tax_percent !== undefined ? body.tax_percent : existing.tax_percent,
            tax_amount: body.tax_amount !== undefined ? body.tax_amount : existing.tax_amount,
            shipping_charge: body.shipping_charge !== undefined ? body.shipping_charge : (body.delivery_charge !== undefined ? body.delivery_charge : existing.shipping_charge),
            amount_paid: body.amount_paid !== undefined ? body.amount_paid : existing.amount_paid,
            payment_status: body.payment_status !== undefined ? body.payment_status : existing.payment_status,
            payment_mode: body.payment_mode !== undefined ? body.payment_mode : existing.payment_mode
        });
        if (finValidation.error) {
            return res.status(400).json({ success: false, message: finValidation.error });
        }

        const currentStaff = await resolveCurrentStaffUser(req.user);
        const fin = finValidation.financials;
        const machineMakeModel = body.machine_make_model !== undefined || body.product_summary !== undefined
            ? ((body.machine_make_model || body.product_summary || '').trim() || null)
            : (existing.machine_make_model || existing.product_summary || null);
        const promisedDate = body.promised_date !== undefined || body.due_date !== undefined
            ? toMysqlDate(body.promised_date || body.due_date)
            : existing.due_date;

        // Historical complaint preservation: never overwrite original_issue_description once recorded
        const preservedOriginalComplaint = existing.original_issue_description || issueDesc || existing.issue_description || null;

        const additionalRemarks = body.additional_remarks !== undefined || body.notes !== undefined
            ? ((body.additional_remarks !== undefined ? body.additional_remarks : body.notes) || '').trim() || null
            : (existing.additional_remarks || existing.notes || null);

        let nextSignature = existing.customer_signature;
        let nextSignatureDate = existing.signature_date;
        if (body.customer_signature !== undefined) {
            const sig = (body.customer_signature || '').trim();
            nextSignature = sig || null;
            if (sig && sig !== existing.customer_signature) {
                nextSignatureDate = new Date();
            } else if (!sig) {
                nextSignatureDate = null;
            }
        }

        const assignedUserId = body.assigned_to ? parseInt(body.assigned_to, 10) : existing.assigned_to;
        const technicianName = body.technician_name !== undefined
            ? (body.technician_name || '').trim() || null
            : existing.technician_name;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(`
                UPDATE customer_support_job_cards SET
                    job_card_date = COALESCE(?, job_card_date),
                    case_id = ?,
                    order_id = ?,
                    customer_name = ?,
                    customer_phone = ?,
                    customer_address = ?,
                    product_summary = ?,
                    machine_make_model = ?,
                    serial_vin_number = ?,
                    hours_run = ?,
                    job_type = ?,
                    priority = ?,
                    status = ?,
                    specific_complaint = ?,
                    issue_description = ?,
                    original_issue_description = ?,
                    work_required = ?,
                    initial_diagnosis = ?,
                    additional_observations = ?,
                    before_work_condition = ?,
                    initial_inspection_remarks = ?,
                    diagnosis = ?,
                    work_performed = ?,
                    parts_replaced_summary = ?,
                    repair_details = ?,
                    additional_remarks = ?,
                    notes = ?,
                    final_machine_condition = ?,
                    work_completion_remarks = ?,
                    parts_total = ?,
                    labour_total = ?,
                    service_cost = ?,
                    discount_amount = ?,
                    taxable_amount = ?,
                    tax_percent = ?,
                    tax_amount = ?,
                    shipping_charge = ?,
                    grand_total = ?,
                    amount_paid = ?,
                    balance_amount = ?,
                    payment_status = ?,
                    payment_mode = ?,
                    assigned_to = ?,
                    technician_name = ?,
                    due_date = ?,
                    work_completion_date = ?,
                    customer_feedback = ?,
                    technician_remarks = ?,
                    customer_signature = ?,
                    signature_date = ?
                WHERE job_card_id = ?
            `, [
                toMysqlDate(body.job_card_date),
                body.case_id !== undefined ? (body.case_id ? parseInt(body.case_id, 10) : null) : existing.case_id,
                body.order_id !== undefined ? (body.order_id ? parseInt(body.order_id, 10) : null) : existing.order_id,
                customerName || existing.customer_name || 'Draft Customer',
                customerPhone,
                body.customer_address !== undefined ? ((body.customer_address || '').trim() || null) : existing.customer_address,
                machineMakeModel,
                machineMakeModel,
                body.serial_vin_number !== undefined ? ((body.serial_vin_number || '').trim() || null) : existing.serial_vin_number,
                body.hours_run !== undefined ? ((body.hours_run || '').trim() || null) : existing.hours_run,
                body.job_type || existing.job_type,
                body.priority || existing.priority,
                requestedStatus,
                specificComplaint || null,
                issueDesc || null,
                preservedOriginalComplaint,
                body.work_required !== undefined ? ((body.work_required || '').trim() || null) : existing.work_required,
                body.initial_diagnosis !== undefined ? ((body.initial_diagnosis || '').trim() || null) : existing.initial_diagnosis,
                body.additional_observations !== undefined ? ((body.additional_observations || '').trim() || null) : existing.additional_observations,
                body.before_work_condition !== undefined ? ((body.before_work_condition || '').trim() || null) : existing.before_work_condition,
                body.initial_inspection_remarks !== undefined ? ((body.initial_inspection_remarks || '').trim() || null) : existing.initial_inspection_remarks,
                body.diagnosis !== undefined ? ((body.diagnosis || '').trim() || null) : existing.diagnosis,
                body.work_performed !== undefined ? ((body.work_performed || '').trim() || null) : existing.work_performed,
                body.parts_replaced_summary !== undefined ? ((body.parts_replaced_summary || '').trim() || null) : existing.parts_replaced_summary,
                body.repair_details !== undefined ? ((body.repair_details || '').trim() || null) : existing.repair_details,
                additionalRemarks,
                additionalRemarks,
                body.final_machine_condition !== undefined ? ((body.final_machine_condition || '').trim() || null) : existing.final_machine_condition,
                body.work_completion_remarks !== undefined ? ((body.work_completion_remarks || '').trim() || null) : existing.work_completion_remarks,
                fin.parts_total, fin.labour_total, fin.service_cost,
                fin.discount_amount, fin.taxable_amount, fin.tax_percent, fin.tax_amount, fin.shipping_charge,
                fin.grand_total, fin.amount_paid, fin.balance_amount,
                fin.payment_status, fin.payment_mode,
                assignedUserId, technicianName, promisedDate,
                body.work_completion_date !== undefined ? toMysqlDateTime(body.work_completion_date) : existing.work_completion_date,
                body.customer_feedback !== undefined ? ((body.customer_feedback || '').trim() || null) : existing.customer_feedback,
                body.technician_remarks !== undefined ? ((body.technician_remarks || '').trim() || null) : existing.technician_remarks,
                nextSignature, nextSignatureDate,
                id
            ]);

            await replaceJobCardPartsAndLabour(connection, id, nextParts, nextLabour);

            const uploaded = await saveJobCardUploadedPhotos(
                connection,
                id,
                req.files,
                body.photo_type || 'BEFORE_WORK',
                currentStaff.userId
            );

            let actionType = 'WORK_SAVED';
            let actionNote = `Job Card details saved (${requestedStatus}) by ${currentStaff.name}`;
            if (requestedStatus === 'Draft') {
                actionType = 'DRAFT_SAVED';
                actionNote = `Draft updated by ${currentStaff.name}`;
            } else if (existing.status === 'Draft' && requestedStatus !== 'Draft') {
                actionType = 'RESUMED';
                actionNote = `Draft resumed and moved to ${requestedStatus} by ${currentStaff.name}`;
            } else if (existing.status !== requestedStatus) {
                actionType = 'STATUS_CHANGED';
                actionNote = `Status updated from ${existing.status} to ${requestedStatus}`;
            }
            if (uploaded.length > 0) {
                actionNote += `. Uploaded ${uploaded.length} photo(s).`;
            }

            await connection.query(`
                INSERT INTO customer_support_job_card_logs
                (job_card_id, action, previous_status, new_status, notes, performed_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                id,
                actionType,
                existing.status !== requestedStatus ? existing.status : null,
                existing.status !== requestedStatus ? requestedStatus : null,
                actionNote,
                currentStaff.userId
            ]);

            await connection.commit();

            res.json({
                success: true,
                message: requestedStatus === 'Draft' ? 'Draft saved successfully' : 'Job Card saved successfully',
                job_card_id: id,
                status: requestedStatus,
                financials: fin,
                uploaded_photos: uploaded
            });
        } catch (trxErr) {
            await connection.rollback();
            throw trxErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error in updateJobCard:', err);
        res.status(500).json({ success: false, message: 'Failed to save job card changes' });
    }
};

// ── UPDATE JOB CARD STATUS (Draft, Open, In Progress, On Hold, Cancelled) ──
exports.updateJobCardStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, cancellation_reason, notes } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const validStatuses = ['Draft', 'Open', 'In Progress', 'On Hold', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
        }

        const [[jobCard]] = await db.query(
            'SELECT job_card_id, job_card_number, status FROM customer_support_job_cards WHERE job_card_id = ?',
            [id]
        );
        if (!jobCard) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }
        if (jobCard.status === 'Completed') {
            return res.status(400).json({ success: false, message: 'Cannot modify a Job Card that is already Completed' });
        }
        if (jobCard.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot modify a Job Card that has been Cancelled' });
        }

        if (status === 'Cancelled' && (!cancellation_reason || !cancellation_reason.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required when cancelling a Job Card'
            });
        }

        const currentUserId = req.user.id || req.user.user_id;
        const isCancelling = status === 'Cancelled';

        await db.query(`
            UPDATE customer_support_job_cards
            SET status = ?,
                cancellation_reason = CASE WHEN ? THEN ? ELSE cancellation_reason END,
                cancelled_at = CASE WHEN ? THEN NOW() ELSE cancelled_at END
            WHERE job_card_id = ?
        `, [
            status,
            isCancelling,
            isCancelling ? cancellation_reason.trim() : null,
            isCancelling,
            id
        ]);

        const logNotes = isCancelling
            ? `Cancelled: ${cancellation_reason.trim()}`
            : (notes ? notes.trim() : `Status changed from ${jobCard.status} to ${status}`);

        await db.query(`
            INSERT INTO customer_support_job_card_logs
            (job_card_id, action, previous_status, new_status, notes, performed_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, isCancelling ? 'CANCELLED' : 'STATUS_CHANGED', jobCard.status, status, logNotes, currentUserId]);

        res.json({
            success: true,
            message: `Job Card status changed to ${status}`,
            job_card_id: id,
            new_status: status
        });
    } catch (err) {
        console.error('Error in updateJobCardStatus:', err);
        res.status(500).json({ success: false, message: 'Failed to change job card status' });
    }
};

// ── UPLOAD JOB CARD PHOTOS (BEFORE_WORK / AFTER_WORK / Legacy types) ──
exports.uploadJobCardPhotos = async (req, res) => {
    try {
        const { id } = req.params;
        const { photo_type = 'BEFORE_WORK', caption } = req.body;

        const [[jobCard]] = await db.query(
            'SELECT job_card_id, status FROM customer_support_job_cards WHERE job_card_id = ?',
            [id]
        );
        if (!jobCard) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }
        if (jobCard.status === 'Completed' || jobCard.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: `Cannot upload photos to a ${jobCard.status} Job Card` });
        }

        const currentUserId = req.user.id || req.user.user_id;
        const uploadedPhotos = await saveJobCardUploadedPhotos(
            db,
            id,
            req.files,
            photo_type,
            currentUserId,
            caption ? caption.trim() : null
        );

        if (uploadedPhotos.length === 0) {
            return res.status(400).json({ success: false, message: 'No photos provided for upload' });
        }

        const stageSummary = [...new Set(uploadedPhotos.map(p => p.photo_type))].join(', ');
        await db.query(`
            INSERT INTO customer_support_job_card_logs
            (job_card_id, action, previous_status, new_status, notes, performed_by)
            VALUES (?, 'PHOTO_UPLOADED', NULL, NULL, ?, ?)
        `, [id, `Uploaded ${uploadedPhotos.length} photo(s) [${stageSummary}]`, currentUserId]);

        res.json({
            success: true,
            message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
            photos: uploadedPhotos
        });
    } catch (err) {
        console.error('Error in uploadJobCardPhotos:', err);
        res.status(500).json({ success: false, message: 'Failed to upload job card photos' });
    }
};

// ── DELETE JOB CARD PHOTO (Deliberate removal with audit trail) ──
exports.deleteJobCardPhoto = async (req, res) => {
    try {
        const { id, photoId } = req.params;

        const [[jobCard]] = await db.query(
            'SELECT job_card_id, status FROM customer_support_job_cards WHERE job_card_id = ?',
            [id]
        );
        if (!jobCard) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }
        if (jobCard.status === 'Completed' || jobCard.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: `Cannot remove photos from a ${jobCard.status} Job Card` });
        }

        const [[photo]] = await db.query(
            'SELECT * FROM customer_support_job_card_photos WHERE photo_id = ? AND job_card_id = ?',
            [photoId, id]
        );
        if (!photo) {
            return res.status(404).json({ success: false, message: 'Photo not found on this Job Card' });
        }

        await db.query('DELETE FROM customer_support_job_card_photos WHERE photo_id = ? AND job_card_id = ?', [photoId, id]);

        // Remove media from R2 (if stored via /api/media/...) and any legacy or fallback local disk file
        if (photo.file_url) {
            const r2Key = storageService.extractKeyFromUrl(photo.file_url);
            if (r2Key && !photo.file_url.startsWith('/uploads/')) {
                try {
                    await storageService.deleteObject({ key: r2Key });
                } catch (r2DelErr) {
                    console.warn('R2 delete warn:', r2DelErr.message);
                }
                const fallbackDiskPath = path.join(__dirname, '../../uploads', r2Key);
                if (fs.existsSync(fallbackDiskPath)) {
                    try { fs.unlinkSync(fallbackDiskPath); } catch (e) { console.warn('Unlink warn:', e.message); }
                }
            } else if (photo.file_url.startsWith('/uploads/')) {
                const filename = path.basename(photo.file_url);
                const diskPath = path.join(__dirname, '../../uploads', filename);
                if (fs.existsSync(diskPath)) {
                    try { fs.unlinkSync(diskPath); } catch (e) { console.warn('Unlink warn:', e.message); }
                }
            }
        }

        const currentUserId = req.user.id || req.user.user_id;
        await db.query(`
            INSERT INTO customer_support_job_card_logs
            (job_card_id, action, previous_status, new_status, notes, performed_by)
            VALUES (?, 'PHOTO_DELETED', NULL, NULL, ?, ?)
        `, [id, `Deleted ${photo.photo_type} photo: ${photo.file_name}`, currentUserId]);

        res.json({
            success: true,
            message: 'Photo removed from Job Card',
            photo_id: Number(photoId)
        });
    } catch (err) {
        console.error('Error in deleteJobCardPhoto:', err);
        res.status(500).json({ success: false, message: 'Failed to remove photo' });
    }
};

// ── COMPLETE JOB CARD ──
exports.completeJobCard = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const [[jobCard]] = await db.query(
            'SELECT * FROM customer_support_job_cards WHERE job_card_id = ?',
            [id]
        );
        if (!jobCard) {
            return res.status(404).json({ success: false, message: 'Job Card not found' });
        }
        if (jobCard.status === 'Completed') {
            return res.status(400).json({ success: false, message: 'This Job Card is already marked as Completed' });
        }
        if (jobCard.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot complete a cancelled Job Card' });
        }

        // Resolve values from payload or existing saved card
        const customerName = (body.customer_name !== undefined ? body.customer_name : jobCard.customer_name || '').trim();
        const customerPhone = (body.customer_phone !== undefined ? body.customer_phone : jobCard.customer_phone || '').trim();
        const issueDesc = (body.issue_description !== undefined ? body.issue_description : jobCard.issue_description || '').trim();
        const specificComplaint = (body.specific_complaint !== undefined ? body.specific_complaint : jobCard.specific_complaint || '').trim();
        const diagnosis = (body.diagnosis !== undefined ? body.diagnosis : jobCard.diagnosis || '').trim();
        const workPerformed = (body.work_performed !== undefined ? body.work_performed : jobCard.work_performed || '').trim();
        const finalCondition = (body.final_machine_condition !== undefined ? body.final_machine_condition : jobCard.final_machine_condition || '').trim();

        // Mandatory completion validations (Section 10)
        if (!customerName || !customerPhone) {
            return res.status(400).json({ success: false, message: 'Customer name and phone number are required before completion' });
        }
        if (!issueDesc && !specificComplaint) {
            return res.status(400).json({ success: false, message: 'Customer complaint details are required before completion' });
        }
        if (!diagnosis) {
            return res.status(400).json({ success: false, message: 'Diagnosis / Findings description is required for completion' });
        }
        if (!workPerformed) {
            return res.status(400).json({ success: false, message: 'Actual Work Performed details are required for completion' });
        }
        if (!finalCondition) {
            return res.status(400).json({ success: false, message: 'Final machine condition is required before completion' });
        }

        let nextParts = null;
        if (body.parts !== undefined) {
            const pVal = normalizeAndValidateParts(body.parts);
            if (pVal.error) return res.status(400).json({ success: false, message: pVal.error });
            nextParts = pVal.items;
        }
        let nextLabour = null;
        if (body.labour !== undefined) {
            const lVal = normalizeAndValidateLabour(body.labour);
            if (lVal.error) return res.status(400).json({ success: false, message: lVal.error });
            nextLabour = lVal.items;
        }

        const partsForCalc = nextParts !== null
            ? nextParts
            : (await db.query('SELECT * FROM customer_support_job_card_parts WHERE job_card_id = ?', [id]))[0];
        const labourForCalc = nextLabour !== null
            ? nextLabour
            : (await db.query('SELECT * FROM customer_support_job_card_labour WHERE job_card_id = ?', [id]))[0];

        const finValidation = calculateAndValidateFinancials(partsForCalc, labourForCalc, {
            discount_amount: body.discount_amount !== undefined ? body.discount_amount : jobCard.discount_amount,
            tax_percent: body.tax_percent !== undefined ? body.tax_percent : jobCard.tax_percent,
            tax_amount: body.tax_amount !== undefined ? body.tax_amount : jobCard.tax_amount,
            shipping_charge: body.shipping_charge !== undefined ? body.shipping_charge : (body.delivery_charge !== undefined ? body.delivery_charge : jobCard.shipping_charge),
            amount_paid: body.amount_paid !== undefined ? body.amount_paid : jobCard.amount_paid,
            payment_status: body.payment_status !== undefined ? body.payment_status : jobCard.payment_status,
            payment_mode: body.payment_mode !== undefined ? body.payment_mode : jobCard.payment_mode
        });
        if (finValidation.error) {
            return res.status(400).json({ success: false, message: finValidation.error });
        }

        const currentStaff = await resolveCurrentStaffUser(req.user);
        const fin = finValidation.financials;
        const machineMakeModel = body.machine_make_model !== undefined || body.product_summary !== undefined
            ? ((body.machine_make_model || body.product_summary || '').trim() || null)
            : (jobCard.machine_make_model || jobCard.product_summary || null);
        const promisedDate = body.promised_date !== undefined || body.due_date !== undefined
            ? toMysqlDate(body.promised_date || body.due_date)
            : jobCard.due_date;
        const preservedOriginalComplaint = jobCard.original_issue_description || issueDesc || jobCard.issue_description || null;
        const completedByName = (body.completed_by_name || '').trim() || currentStaff.name;
        const workCompletionDate = toMysqlDateTime(body.work_completion_date) || new Date();

        const completionNoteText = (body.completion_notes || body.work_completion_remarks || '').trim();
        const rawRemarks = body.additional_remarks !== undefined ? body.additional_remarks : jobCard.additional_remarks;
        const updatedNotes = body.notes !== undefined
            ? ((body.notes || '').trim() || null)
            : (completionNoteText && jobCard.notes && !jobCard.notes.includes(completionNoteText)
                ? `${jobCard.notes}\n[Completion]: ${completionNoteText}`
                : (jobCard.notes || completionNoteText || null));

        let nextSignature = jobCard.customer_signature;
        let nextSignatureDate = jobCard.signature_date;
        if (body.customer_signature !== undefined) {
            const sig = (body.customer_signature || '').trim();
            nextSignature = sig || null;
            if (sig && sig !== jobCard.customer_signature) {
                nextSignatureDate = new Date();
            }
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            await replaceJobCardPartsAndLabour(connection, id, nextParts, nextLabour);

            await saveJobCardUploadedPhotos(
                connection,
                id,
                req.files,
                'AFTER_WORK',
                currentStaff.userId
            );

            await connection.query(`
                UPDATE customer_support_job_cards SET
                    status = 'Completed',
                    customer_name = ?,
                    customer_phone = ?,
                    customer_address = ?,
                    product_summary = ?,
                    machine_make_model = ?,
                    serial_vin_number = ?,
                    hours_run = ?,
                    job_type = ?,
                    priority = ?,
                    specific_complaint = ?,
                    issue_description = ?,
                    original_issue_description = ?,
                    work_required = ?,
                    initial_diagnosis = ?,
                    additional_observations = ?,
                    before_work_condition = ?,
                    initial_inspection_remarks = ?,
                    diagnosis = ?,
                    work_performed = ?,
                    parts_replaced_summary = ?,
                    repair_details = ?,
                    additional_remarks = ?,
                    notes = ?,
                    final_machine_condition = ?,
                    work_completion_remarks = ?,
                    parts_total = ?,
                    labour_total = ?,
                    service_cost = ?,
                    discount_amount = ?,
                    taxable_amount = ?,
                    tax_percent = ?,
                    tax_amount = ?,
                    shipping_charge = ?,
                    grand_total = ?,
                    amount_paid = ?,
                    balance_amount = ?,
                    payment_status = ?,
                    payment_mode = ?,
                    due_date = ?,
                    work_completion_date = ?,
                    customer_feedback = ?,
                    technician_remarks = ?,
                    completed_by = ?,
                    completed_by_name = ?,
                    customer_signature = ?,
                    signature_date = ?,
                    completed_at = NOW()
                WHERE job_card_id = ?
            `, [
                customerName,
                customerPhone,
                body.customer_address !== undefined ? ((body.customer_address || '').trim() || null) : jobCard.customer_address,
                machineMakeModel,
                machineMakeModel,
                body.serial_vin_number !== undefined ? ((body.serial_vin_number || '').trim() || null) : jobCard.serial_vin_number,
                body.hours_run !== undefined ? ((body.hours_run || '').trim() || null) : jobCard.hours_run,
                body.job_type || jobCard.job_type,
                body.priority || jobCard.priority,
                specificComplaint || null,
                issueDesc || null,
                preservedOriginalComplaint,
                body.work_required !== undefined ? ((body.work_required || '').trim() || null) : jobCard.work_required,
                body.initial_diagnosis !== undefined ? ((body.initial_diagnosis || '').trim() || null) : jobCard.initial_diagnosis,
                body.additional_observations !== undefined ? ((body.additional_observations || '').trim() || null) : jobCard.additional_observations,
                body.before_work_condition !== undefined ? ((body.before_work_condition || '').trim() || null) : jobCard.before_work_condition,
                body.initial_inspection_remarks !== undefined ? ((body.initial_inspection_remarks || '').trim() || null) : jobCard.initial_inspection_remarks,
                diagnosis,
                workPerformed,
                body.parts_replaced_summary !== undefined ? ((body.parts_replaced_summary || '').trim() || null) : jobCard.parts_replaced_summary,
                body.repair_details !== undefined ? ((body.repair_details || '').trim() || null) : jobCard.repair_details,
                rawRemarks || null,
                updatedNotes,
                finalCondition,
                completionNoteText || jobCard.work_completion_remarks || null,
                fin.parts_total, fin.labour_total, fin.service_cost,
                fin.discount_amount, fin.taxable_amount, fin.tax_percent, fin.tax_amount, fin.shipping_charge,
                fin.grand_total, fin.amount_paid, fin.balance_amount,
                fin.payment_status, fin.payment_mode,
                promisedDate,
                workCompletionDate,
                body.customer_feedback !== undefined ? ((body.customer_feedback || '').trim() || null) : jobCard.customer_feedback,
                body.technician_remarks !== undefined ? ((body.technician_remarks || '').trim() || null) : jobCard.technician_remarks,
                currentStaff.userId,
                completedByName,
                nextSignature,
                nextSignatureDate,
                id
            ]);

            const partsListDesc = partsForCalc.length > 0
                ? `${partsForCalc.length} part(s) (Parts: ₹${fin.parts_total}, Labour: ₹${fin.labour_total}, Grand Total: ₹${fin.grand_total})`
                : `No parts used (Labour: ₹${fin.labour_total}, Grand Total: ₹${fin.grand_total})`;

            await connection.query(`
                INSERT INTO customer_support_job_card_logs
                (job_card_id, action, previous_status, new_status, notes, performed_by)
                VALUES (?, 'COMPLETED', ?, 'Completed', ?, ?)
            `, [
                id,
                jobCard.status,
                `Work completed by ${completedByName}. Final condition: ${finalCondition}. Diagnosis: ${diagnosis}. Work performed: ${workPerformed}. ${partsListDesc}.`,
                currentStaff.userId
            ]);

            // Update linked support case note ONLY — do NOT automatically close the support case
            if (jobCard.case_id) {
                const partsSummary = partsForCalc.length > 0
                    ? ` Parts: ${partsForCalc.map(p => `${p.part_name} (x${p.quantity}${p.is_foc ? ' - FOC' : ''})`).join(', ')}.`
                    : '';
                const caseNote = `[Job Card ${jobCard.job_card_number} Completed]: Diagnosis: ${diagnosis}. Work Performed: ${workPerformed}. Final Condition: ${finalCondition}.${partsSummary} Total Charges: ₹${fin.grand_total} (Sent for Billing).`;
                await connection.query(`
                    INSERT INTO customer_support_notes (case_id, note, created_by)
                    VALUES (?, ?, ?)
                `, [jobCard.case_id, caseNote, currentStaff.userId]);
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Job Card marked as completed successfully',
                job_card_id: id,
                job_card_number: jobCard.job_card_number,
                financials: fin
            });
        } catch (trxErr) {
            await connection.rollback();
            throw trxErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error in completeJobCard:', err);
        res.status(500).json({ success: false, message: 'Failed to complete job card' });
    }
};



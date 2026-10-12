const db = require('../config/db');
const notificationService = require('./notification.service');

/**
 * Customer Support Service
 * Handles B2C delivery events, case assignments, calls, follow-ups, and notifications.
 */
class CustomerSupportService {

    /**
     * Handles order delivered event idempotently.
     * Verifies order eligibility (B2C & SGB Direct), creates case, assigns executive, and dispatches notification.
     */
    async handleOrderDelivered(orderId) {
        if (!orderId) throw new Error('Order ID is required');

        try {
            // 1. Fetch order details
            const [orders] = await db.query(`
                SELECT o.*, l.source as lead_source
                FROM orders o
                LEFT JOIN leads l ON o.lead_id = l.lead_id
                WHERE o.order_id = ?
            `, [orderId]);

            if (orders.length === 0) {
                console.warn(`[CustomerSupport] Order #${orderId} not found.`);
                return { success: false, reason: 'Order not found' };
            }

            const order = orders[0];

            // 2. Eligibility checks
            // B2C check: order_source must be 'lead' and dealer_id must be null
            const isB2C = order.order_source === 'lead' && !order.dealer_id;
            
            // SGB Direct check: purchase_source must be 'SGB Direct' (or default 'SGB Direct' for lead orders)
            const purchaseSource = order.purchase_source || 'SGB Direct';
            const isSgbDirect = purchaseSource.toLowerCase().includes('sgb') || purchaseSource.toLowerCase().includes('direct');

            if (!isB2C || !isSgbDirect) {
                console.log(`[CustomerSupport] Order #${orderId} excluded: isB2C=${isB2C}, isSgbDirect=${isSgbDirect}, order_source=${order.order_source}`);
                return { success: false, eligible: false, reason: 'Not an eligible B2C SGB Direct order' };
            }

            // 3. Idempotency check: verify case doesn't already exist
            const [existing] = await db.query(
                'SELECT case_id, case_number, status, assigned_to FROM customer_support_cases WHERE order_id = ?',
                [orderId]
            );

            if (existing.length > 0) {
                console.log(`[CustomerSupport] Case already exists for Order #${orderId} (Case #${existing[0].case_number}). No duplicates created.`);
                return { success: true, alreadyExists: true, caseId: existing[0].case_id, caseNumber: existing[0].case_number };
            }

            // 4. Fetch product summary
            const [items] = await db.query(`
                SELECT oi.quantity, p.name as product_name
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ?
            `, [orderId]);

            const productSummary = items.map(item => `${item.product_name || 'Product'} (x${item.quantity})`).join(', ') || 'Agricultural Equipment';

            // 5. Auto-assignment (Round-Robin among active Customer Support Executives)
            let assignedTo = null;
            let assignedStaffName = 'Unassigned';

            const [staffRows] = await db.query(`
                SELECT u.user_id, u.name 
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE (LOWER(r.name) LIKE '%support%' OR u.department_id = 19)
                  AND u.status = 'active'
                ORDER BY u.updated_at ASC
                LIMIT 1
            `);

            if (staffRows.length > 0) {
                assignedTo = staffRows[0].user_id;
                assignedStaffName = staffRows[0].name;
                // Touch updated_at to move executive to back of round-robin
                await db.query('UPDATE users SET updated_at = NOW() WHERE user_id = ?', [assignedTo]);
            }

            // 6. Generate Case Number
            const year = new Date().getFullYear();
            const caseNumber = `CS-${year}-${String(orderId).padStart(5, '0')}`;
            const customerName = order.customer_name || 'Valued Customer';
            const customerPhone = order.phone || '';
            const deliveryDate = order.updated_at || new Date();

            // 7. Insert Case
            const [insertResult] = await db.query(`
                INSERT INTO customer_support_cases 
                (case_number, order_id, lead_id, customer_name, customer_phone, product_summary, assigned_to, status, delivery_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'delivered', ?)
            `, [caseNumber, orderId, order.lead_id || null, customerName, customerPhone, productSummary, assignedTo, deliveryDate]);

            const caseId = insertResult.insertId;

            // 8. Add initial system note
            await db.query(`
                INSERT INTO customer_support_notes (case_id, note, created_by)
                VALUES (?, ?, ?)
            `, [caseId, `System: Delivery confirmed. Initial B2C support case created and assigned to ${assignedStaffName}.`, assignedTo || 1]);

            // 9. Create In-App Notification & FCM Notification
            const notifTitle = `New Delivered Order: Support Required`;
            const notifMsg = `Customer: ${customerName} | Phone: ${customerPhone} | Product: ${productSummary} | Order #${orderId} | Case #${caseNumber}`;
            const notifLink = `modules/customer_support/customer_details.html?case_id=${caseId}`;
            const notifData = {
                caseId: String(caseId),
                orderId: String(orderId),
                caseNumber,
                customerName,
                customerPhone,
                productSummary,
                deliveryDate: new Date(deliveryDate).toISOString(),
                type: 'customer_support_new_case'
            };

            // Store in-app notification in DB
            if (assignedTo) {
                await db.query(`
                    INSERT INTO notifications (order_id, user_id, title, message, type, link, data, status)
                    VALUES (?, ?, ?, ?, 'customer_support_new_case', ?, ?, 'sent')
                `, [orderId, assignedTo, notifTitle, notifMsg, notifLink, JSON.stringify(notifData)]);

                // Dispatch FCM push
                await notificationService.sendToUser(assignedTo, notifTitle, notifMsg, notifData).catch(e => console.warn('FCM user warn:', e.message));
            } else {
                // If unassigned, notify admins
                await db.query(`
                    INSERT INTO notifications (order_id, user_id, title, message, type, link, data, status)
                    VALUES (?, NULL, ?, ?, 'customer_support_new_case', ?, ?, 'sent')
                `, [orderId, notifTitle, notifMsg, notifLink, JSON.stringify(notifData)]);
                await notificationService.sendToRole('admin', notifTitle, notifMsg, notifData).catch(e => console.warn('FCM admin warn:', e.message));
            }

            console.log(`✅ [CustomerSupport] Successfully created Case #${caseNumber} for Order #${orderId}. Assigned to user #${assignedTo} (${assignedStaffName}).`);

            return {
                success: true,
                caseId,
                caseNumber,
                assignedTo,
                assignedStaffName,
                customerName
            };

        } catch (err) {
            console.error(`❌ [CustomerSupport] Failed to handle delivery for Order #${orderId}:`, err);
            throw err;
        }
    }

    /**
     * Get dashboard summary counts for cards
     */
    async getDashboardMetrics(user) {
        let userFilter = '';
        let params = [];

        // If executive (not admin/super-admin/manager), only show cases assigned to them
        const isManagerOrAdmin = user && (user.role === 'admin' || user.role === 'super-admin' || user.is_manager || (user.role && user.role.includes('manager')));
        if (!isManagerOrAdmin && user && user.id) {
            userFilter = 'AND (c.assigned_to = ? OR c.assigned_to IS NULL)';
            params.push(user.id);
        }

        const [[counts]] = await db.query(`
            SELECT 
                SUM(CASE WHEN c.status = 'delivered' THEN 1 ELSE 0 END) as new_delivered,
                SUM(CASE WHEN c.status IN ('delivered', 'pending_contact') THEN 1 ELSE 0 END) as pending_installation,
                SUM(CASE WHEN c.status IN ('contacted', 'guidance_in_progress') THEN 1 ELSE 0 END) as contacted_followup,
                SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_cases
            FROM customer_support_cases c
            WHERE 1=1 ${userFilter}
        `, params);

        // Follow-ups metrics
        let fuParams = [];
        let fuUserFilter = '';
        if (!isManagerOrAdmin && user && user.id) {
            fuUserFilter = 'AND (f.assigned_to = ? OR f.assigned_to IS NULL)';
            fuParams.push(user.id);
        }

        const [[fuCounts]] = await db.query(`
            SELECT 
                SUM(CASE WHEN f.status = 'DUE' OR (f.status = 'UPCOMING' AND f.scheduled_date <= CURDATE()) THEN 1 ELSE 0 END) as followups_due,
                SUM(CASE WHEN f.status = 'OVERDUE' OR (f.status != 'COMPLETED' AND f.scheduled_date < CURDATE()) THEN 1 ELSE 0 END) as followups_overdue
            FROM customer_support_followups f
            WHERE f.status != 'COMPLETED' ${fuUserFilter}
        `, fuParams);

        return {
            new_delivered: Number(counts.new_delivered || 0),
            pending_installation: Number(counts.pending_installation || 0),
            contacted_followup: Number(counts.contacted_followup || 0),
            completed_cases: Number(counts.completed_cases || 0),
            followups_due: Number(fuCounts.followups_due || 0),
            followups_overdue: Number(fuCounts.followups_overdue || 0)
        };
    }

    /**
     * Checks and updates due & overdue 30-day follow-ups, dispatching in-app notifications.
     */
    async processDueFollowups() {
        try {
            // Find follow-ups that have reached their scheduled date and haven't notified yet
            const [dueFollowups] = await db.query(`
                SELECT f.*, c.case_number, c.customer_name, c.customer_phone, c.product_summary
                FROM customer_support_followups f
                JOIN customer_support_cases c ON f.case_id = c.case_id
                WHERE f.status IN ('UPCOMING', 'DUE')
                  AND f.scheduled_date <= CURDATE()
            `);

            for (const fu of dueFollowups) {
                const isOverdue = new Date(fu.scheduled_date) < new Date(new Date().toDateString());
                const newStatus = isOverdue ? 'OVERDUE' : 'DUE';

                await db.query(`
                    UPDATE customer_support_followups 
                    SET status = ? 
                    WHERE followup_id = ?
                `, [newStatus, fu.followup_id]);

                // Generate notification once per follow-up task
                if (!fu.notification_sent && fu.assigned_to) {
                    const title = `30-Day Follow-Up Due: ${fu.customer_name}`;
                    const msg = `Follow-up product check due for Order #${fu.order_id} (Customer: ${fu.customer_name}, Phone: ${fu.customer_phone}). Please call customer to record product condition and feedback.`;
                    const link = `modules/customer_support/followup_details.html?followup_id=${fu.followup_id}`;
                    const data = {
                        followupId: String(fu.followup_id),
                        caseId: String(fu.case_id),
                        orderId: String(fu.order_id),
                        customerName: fu.customer_name,
                        customerPhone: fu.customer_phone,
                        scheduledDate: fu.scheduled_date,
                        type: 'customer_support_followup_due'
                    };

                    await db.query(`
                        INSERT INTO notifications (order_id, user_id, title, message, type, link, data, status)
                        VALUES (?, ?, ?, ?, 'customer_support_followup_due', ?, ?, 'sent')
                    `, [fu.order_id, fu.assigned_to, title, msg, link, JSON.stringify(data)]);

                    await notificationService.sendToUser(fu.assigned_to, title, msg, data).catch(e => console.warn('FCM FU warn:', e.message));

                    await db.query('UPDATE customer_support_followups SET notification_sent = 1 WHERE followup_id = ?', [fu.followup_id]);
                }
            }

            return { processedCount: dueFollowups.length };
        } catch (err) {
            console.error('Error processing due follow-ups:', err);
            return { error: err.message };
        }
    }
}

module.exports = new CustomerSupportService();

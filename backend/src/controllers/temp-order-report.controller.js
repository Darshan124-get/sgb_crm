/**
 * temp-order-report.controller.js
 * ─────────────────────────────────────────────────────────────
 * CRUD + monthly summary for the Sales Manager's manual
 * telecaller sales tracking (temp_order_report table).
 * ─────────────────────────────────────────────────────────────
 */

const pool = require('../config/db');

// ── Helper: safe integer parse ────────────────────────────────
const toInt = (v) => parseInt(v, 10) || null;
const toFloat = (v) => parseFloat(v) || 0;

// ─────────────────────────────────────────────────────────────
// GET /api/temp-order-report
// Query params: date, month, year, telecaller_id, page, limit
// ─────────────────────────────────────────────────────────────
exports.getRecords = async (req, res) => {
    try {
        const { date, month, year, telecaller_id } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (date) {
            whereClause += ' AND record_date = ?';
            params.push(date);
        } else {
            if (month) {
                whereClause += ' AND MONTH(record_date) = ?';
                params.push(toInt(month));
            }
            if (year) {
                whereClause += ' AND YEAR(record_date) = ?';
                params.push(toInt(year));
            }
        }

        if (telecaller_id) {
            whereClause += ' AND telecaller_id = ?';
            params.push(toInt(telecaller_id));
        }

        const query = `
            SELECT
                id,
                DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date,
                telecaller_id,
                telecaller_name,
                product_id,
                product_name,
                unit_price,
                quantity,
                final_amount,
                notes,
                recorded_by,
                created_at,
                updated_at
            FROM temp_order_report
            ${whereClause}
            ORDER BY record_date DESC, created_at DESC
        `;

        const [rows] = await pool.query(query, params);

        // Compute totals for the filtered result set
        const totalQty    = rows.reduce((s, r) => s + (r.quantity || 0), 0);
        const totalAmount = rows.reduce((s, r) => s + parseFloat(r.final_amount || 0), 0);

        return res.json({
            success: true,
            count: rows.length,
            totalQty,
            totalAmount: totalAmount.toFixed(2),
            records: rows,
        });
    } catch (err) {
        console.error('[TOR] getRecords error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch records' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/temp-order-report
// Body: record_date, telecaller_id, product_id, unit_price,
//       quantity, final_amount, notes
// ─────────────────────────────────────────────────────────────
exports.createRecord = async (req, res) => {
    try {
        const {
            record_date,
            telecaller_id,
            product_id,
            unit_price,
            quantity,
            final_amount,
            notes,
        } = req.body;

        // Validate required fields
        if (!record_date)     return res.status(400).json({ success: false, error: 'record_date is required' });
        if (!telecaller_id)   return res.status(400).json({ success: false, error: 'telecaller_id is required' });
        if (!product_id)      return res.status(400).json({ success: false, error: 'product_id is required' });

        // Resolve telecaller name
        const [tcRows] = await pool.query(
            'SELECT name FROM users WHERE user_id = ?',
            [toInt(telecaller_id)]
        );
        if (!tcRows.length) return res.status(400).json({ success: false, error: 'Telecaller not found' });
        const telecaller_name = tcRows[0].name;

        // Resolve product name (and fallback price if not provided)
        const [pRows] = await pool.query(
            'SELECT name, selling_price FROM products WHERE product_id = ?',
            [toInt(product_id)]
        );
        if (!pRows.length) return res.status(400).json({ success: false, error: 'Product not found' });
        const product_name = pRows[0].name;
        const resolvedUnitPrice = toFloat(unit_price) || toFloat(pRows[0].selling_price);

        const qty = toInt(quantity) || 1;
        const resolvedFinalAmount = final_amount !== undefined && final_amount !== ''
            ? toFloat(final_amount)
            : resolvedUnitPrice * qty;

        const [result] = await pool.query(
            `INSERT INTO temp_order_report
                (record_date, telecaller_id, telecaller_name, product_id, product_name,
                 unit_price, quantity, final_amount, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record_date,
                toInt(telecaller_id),
                telecaller_name,
                toInt(product_id),
                product_name,
                resolvedUnitPrice,
                qty,
                resolvedFinalAmount,
                notes || null,
                req.user.id,
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Record saved successfully',
            id: result.insertId,
        });
    } catch (err) {
        console.error('[TOR] createRecord error:', err);
        return res.status(500).json({ success: false, error: 'Failed to create record' });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/temp-order-report/:id
// Body: any subset of record fields
// ─────────────────────────────────────────────────────────────
exports.updateRecord = async (req, res) => {
    try {
        const recordId = toInt(req.params.id);
        if (!recordId) return res.status(400).json({ success: false, error: 'Invalid record ID' });

        const {
            record_date,
            telecaller_id,
            product_id,
            unit_price,
            quantity,
            final_amount,
            notes,
        } = req.body;

        // Fetch existing record
        const [existing] = await pool.query(
            'SELECT * FROM temp_order_report WHERE id = ?',
            [recordId]
        );
        if (!existing.length) return res.status(404).json({ success: false, error: 'Record not found' });
        const rec = existing[0];

        // Resolve telecaller name if telecaller_id changed
        let telecaller_name = rec.telecaller_name;
        const tcId = telecaller_id ? toInt(telecaller_id) : rec.telecaller_id;
        if (telecaller_id && toInt(telecaller_id) !== rec.telecaller_id) {
            const [tcRows] = await pool.query('SELECT name FROM users WHERE user_id = ?', [tcId]);
            if (tcRows.length) telecaller_name = tcRows[0].name;
        }

        // Resolve product name if product_id changed
        let product_name = rec.product_name;
        let resolvedUnitPrice = toFloat(unit_price !== undefined ? unit_price : rec.unit_price);
        const pId = product_id ? toInt(product_id) : rec.product_id;
        if (product_id && toInt(product_id) !== rec.product_id) {
            const [pRows] = await pool.query(
                'SELECT name, selling_price FROM products WHERE product_id = ?',
                [pId]
            );
            if (pRows.length) {
                product_name = pRows[0].name;
                if (unit_price === undefined) resolvedUnitPrice = toFloat(pRows[0].selling_price);
            }
        }

        const qty = quantity !== undefined ? (toInt(quantity) || 1) : rec.quantity;
        const resolvedFinalAmount = final_amount !== undefined && final_amount !== ''
            ? toFloat(final_amount)
            : rec.final_amount;

        await pool.query(
            `UPDATE temp_order_report SET
                record_date     = ?,
                telecaller_id   = ?,
                telecaller_name = ?,
                product_id      = ?,
                product_name    = ?,
                unit_price      = ?,
                quantity        = ?,
                final_amount    = ?,
                notes           = ?
             WHERE id = ?`,
            [
                record_date  || rec.record_date,
                tcId,
                telecaller_name,
                pId,
                product_name,
                resolvedUnitPrice,
                qty,
                resolvedFinalAmount,
                notes !== undefined ? (notes || null) : rec.notes,
                recordId,
            ]
        );

        return res.json({ success: true, message: 'Record updated successfully' });
    } catch (err) {
        console.error('[TOR] updateRecord error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update record' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/temp-order-report/:id
// ─────────────────────────────────────────────────────────────
exports.deleteRecord = async (req, res) => {
    try {
        const recordId = toInt(req.params.id);
        if (!recordId) return res.status(400).json({ success: false, error: 'Invalid record ID' });

        const [result] = await pool.query(
            'DELETE FROM temp_order_report WHERE id = ?',
            [recordId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Record not found' });
        }

        return res.json({ success: true, message: 'Record deleted successfully' });
    } catch (err) {
        console.error('[TOR] deleteRecord error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete record' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/temp-order-report/summary
// Query params: telecaller_id (optional), month, year
// Returns: per-product totals + grand total for the given
//          telecaller in the given month/year
// ─────────────────────────────────────────────────────────────
exports.getSummary = async (req, res) => {
    try {
        const { telecaller_id, month, year } = req.query;

        // Default to current month/year if not provided
        const now = new Date();
        const resolvedMonth = month ? toInt(month) : now.getMonth() + 1;
        const resolvedYear  = year  ? toInt(year)  : now.getFullYear();

        let whereClause = 'WHERE MONTH(record_date) = ? AND YEAR(record_date) = ?';
        const params = [resolvedMonth, resolvedYear];

        if (telecaller_id) {
            whereClause += ' AND telecaller_id = ?';
            params.push(toInt(telecaller_id));
        }

        // Product-wise totals
        const [productRows] = await pool.query(
            `SELECT
                product_id,
                product_name,
                SUM(quantity) AS total_qty,
                SUM(final_amount) AS total_amount
             FROM temp_order_report
             ${whereClause}
             GROUP BY product_id, product_name
             ORDER BY total_amount DESC`,
            params
        );

        // Telecaller-wise totals (if no specific telecaller, show all)
        const [telecallerRows] = await pool.query(
            `SELECT
                telecaller_id,
                telecaller_name,
                SUM(quantity)    AS total_qty,
                SUM(final_amount) AS total_amount,
                COUNT(*) AS record_count
             FROM temp_order_report
             ${whereClause}
             GROUP BY telecaller_id, telecaller_name
             ORDER BY total_amount DESC`,
            params
        );

        // Grand totals
        const grandQty    = productRows.reduce((s, r) => s + (parseInt(r.total_qty) || 0), 0);
        const grandAmount = productRows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

        return res.json({
            success: true,
            filters: {
                month: resolvedMonth,
                year: resolvedYear,
                telecaller_id: telecaller_id ? toInt(telecaller_id) : null,
            },
            grandTotal: {
                qty: grandQty,
                amount: grandAmount.toFixed(2),
            },
            byProduct: productRows.map(r => ({
                ...r,
                total_qty:    parseInt(r.total_qty),
                total_amount: parseFloat(r.total_amount || 0).toFixed(2),
            })),
            byTelecaller: telecallerRows.map(r => ({
                ...r,
                total_qty:    parseInt(r.total_qty),
                total_amount: parseFloat(r.total_amount || 0).toFixed(2),
                record_count: parseInt(r.record_count),
            })),
        });
    } catch (err) {
        console.error('[TOR] getSummary error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch summary' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/temp-order-report/batch
// Body: { record_date, telecaller_id, items: [ { product_id, unit_price, quantity, final_amount, notes } ] }
// Saves multiple product lines for one telecaller in a single request.
// ─────────────────────────────────────────────────────────────
exports.createBatch = async (req, res) => {
    const { record_date, telecaller_id, items } = req.body;

    if (!record_date)   return res.status(400).json({ success: false, error: 'record_date is required' });
    if (!telecaller_id) return res.status(400).json({ success: false, error: 'telecaller_id is required' });
    if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ success: false, error: 'items array must not be empty' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Resolve telecaller
        const [tcRows] = await connection.query('SELECT name FROM users WHERE user_id = ?', [toInt(telecaller_id)]);
        if (!tcRows.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: 'Telecaller not found' });
        }
        const telecaller_name = tcRows[0].name;

        const insertedIds = [];

        for (const item of items) {
            const { product_id, unit_price, quantity, final_amount, notes } = item;
            if (!product_id) continue;

            // Resolve product
            const [pRows] = await connection.query(
                'SELECT name, selling_price FROM products WHERE product_id = ?',
                [toInt(product_id)]
            );
            if (!pRows.length) continue;

            const product_name      = pRows[0].name;
            const resolvedUnitPrice = toFloat(unit_price) || toFloat(pRows[0].selling_price);
            const qty               = toInt(quantity) || 1;
            const resolvedFinal     = (final_amount !== undefined && final_amount !== '')
                ? toFloat(final_amount)
                : resolvedUnitPrice * qty;

            const [result] = await connection.query(
                `INSERT INTO temp_order_report
                    (record_date, telecaller_id, telecaller_name, product_id, product_name,
                     unit_price, quantity, final_amount, notes, recorded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    record_date, toInt(telecaller_id), telecaller_name,
                    toInt(product_id), product_name,
                    resolvedUnitPrice, qty, resolvedFinal,
                    notes || null, req.user.id,
                ]
            );
            insertedIds.push(result.insertId);
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: `${insertedIds.length} record(s) saved successfully`,
            savedCount: insertedIds.length,
            ids: insertedIds,
        });
    } catch (err) {
        try { await connection.rollback(); } catch (_) {}
        console.error('[TOR] createBatch error:', err);
        return res.status(500).json({ success: false, error: 'Failed to save batch records' });
    } finally {
        connection.release();
    }
};

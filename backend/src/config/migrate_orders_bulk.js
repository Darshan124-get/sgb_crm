const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const pool = require('./db');

// Utility to parse command line args
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        file: null,
        dryRun: false,
        autoCreateDealers: true,
        batchSize: 500
    };

    for (const arg of args) {
        if (arg.startsWith('--file=')) {
            options.file = arg.split('=')[1];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--no-auto-create-dealers') {
            options.autoCreateDealers = false;
        } else if (arg.startsWith('--batch-size=')) {
            options.batchSize = parseInt(arg.split('=')[1], 10) || 500;
        }
    }

    return options;
}

// Clean phone numbers to 10 digits
function sanitizePhone(phoneStr) {
    if (!phoneStr) return '';
    const cleaned = String(phoneStr).replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return cleaned.substring(2);
    }
    if (cleaned.length > 10) {
        return cleaned.slice(-10);
    }
    return cleaned;
}

// Parse date strings or Excel serial numbers accurately
function parseOrderDate(rawDate) {
    if (!rawDate) return new Date();

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return rawDate;
    }

    if (typeof rawDate === 'number') {
        const parsed = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const str = String(rawDate).trim();
    if (!str) return new Date();

    const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1], 10);
        const month = parseInt(yyyymmddMatch[2], 10) - 1;
        const day = parseInt(yyyymmddMatch[3], 10);
        const parsed = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        const year = parseInt(ddmmyyyyMatch[3], 10);
        const parsed = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    return new Date();
}

function parseFlexibleNumber(val, defaultVal = 0) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    const str = String(val).trim();
    if (!str) return defaultVal;
    const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return defaultVal;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultVal : parsed;
}

// Format Date object into MySQL DATETIME string YYYY-MM-DD HH:mm:ss
function formatMySqlDateTime(dateObj) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = dateObj.getFullYear();
    const month = pad(dateObj.getMonth() + 1);
    const day = pad(dateObj.getDate());
    const hours = pad(dateObj.getHours());
    const minutes = pad(dateObj.getMinutes());
    const seconds = pad(dateObj.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeOrderStatus(val) {
    if (!val) return 'delivered';
    const str = String(val).trim().toLowerCase().replace(/[\s\-]+/g, '_');
    if (['draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(str)) {
        return str;
    }
    if (['completed', 'complete', 'done', 'success', 'closed', 'fulfilled', 'received', 'successful'].includes(str)) {
        return 'delivered';
    }
    if (['in_review', 'review', 'pending_approval', 'under_review', 'inreview', 'reviewing'].includes(str)) {
        return 'in_review';
    }
    if (['dispatched', 'dispatch', 'in_transit', 'transit', 'out_for_delivery', 'shipping'].includes(str)) {
        return 'shipped';
    }
    if (['approved', 'billing_done', 'invoice_generated', 'invoiced', 'billing'].includes(str)) {
        return 'billed';
    }
    if (['packing', 'packed_and_ready', 'ready_for_shipment'].includes(str)) {
        return 'packed';
    }
    if (['canceled', 'rejected', 'void', 'cancel'].includes(str)) {
        return 'cancelled';
    }
    if (['new', 'pending', 'created', 'open'].includes(str)) {
        return 'draft';
    }
    return 'delivered';
}

// Recalculate dealer status based on latest order date
async function syncDealerStatus(dealerId, connection) {
    if (!dealerId) return;
    try {
        const [orderRows] = await connection.query(
            `SELECT MAX(created_at) as last_order_date 
             FROM orders 
             WHERE dealer_id = ? AND (order_status IS NULL OR LOWER(order_status) != 'cancelled')`,
            [dealerId]
        );

        const lastOrderDate = orderRows[0]?.last_order_date ? new Date(orderRows[0].last_order_date) : null;
        let computedStatus = 'Inactive';

        if (lastOrderDate && !isNaN(lastOrderDate.getTime())) {
            const now = new Date();
            const effectiveOrderDate = lastOrderDate.getTime() > now.getTime() ? now : lastOrderDate;
            const diffMs = (now.getTime() - effectiveOrderDate.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays <= 45) {
                computedStatus = 'Active';
            }
        }

        await connection.query('UPDATE dealers SET status = ? WHERE dealer_id = ?', [computedStatus, dealerId]);
    } catch (e) {
        console.warn(`[SyncStatus Warning] Failed to update status for dealer ${dealerId}:`, e.message);
    }
}

async function bulkMigrateOrders() {
    const options = parseArgs();
    const startTime = Date.now();

    console.log('====================================================');
    console.log('   SGB CRM - 1-YEAR BULK ORDER & DEALER MIGRATION    ');
    console.log('====================================================');
    console.log(`Dry Run Mode       : ${options.dryRun ? 'YES (No database writes)' : 'NO (Live database import)'}`);
    console.log(`Auto-Create Dealers: ${options.autoCreateDealers ? 'YES' : 'NO'}`);
    console.log(`Batch Size         : ${options.batchSize} rows`);

    if (!options.file) {
        console.error('\nERROR: Please specify a file using --file=<path_to_excel_or_csv>');
        console.log('\nUsage Examples:');
        console.log('  node migrate_orders_bulk.js --file="./data/orders_2025.xlsx" --dry-run');
        console.log('  node migrate_orders_bulk.js --file="./data/orders_2025.xlsx"');
        process.exit(1);
    }

    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
        console.error(`\nERROR: Specified file does not exist: ${filePath}`);
        process.exit(1);
    }

    console.log(`Reading File       : ${filePath}`);

    // Load existing database records for fast memory lookups
    const connection = await pool.getConnection();

    try {
        // Fetch existing dealers
        const [dealersList] = await connection.query(`SELECT dealer_id, dealer_name, phone, gst_no, vrl_code, town_village, city, state FROM dealers`);
        
        const phoneMap = new Map();
        const gstMap = new Map();
        const vrlMap = new Map();
        const nameMap = new Map();

        dealersList.forEach(d => {
            const cleanP = sanitizePhone(d.phone);
            if (cleanP) phoneMap.set(cleanP, d.dealer_id);
            if (d.gst_no) gstMap.set(String(d.gst_no).trim().toUpperCase(), d.dealer_id);
            if (d.vrl_code) vrlMap.set(String(d.vrl_code).trim().toUpperCase(), d.dealer_id);
            if (d.dealer_name) nameMap.set(String(d.dealer_name).trim().toLowerCase(), d.dealer_id);
        });

        console.log(`Existing Dealers Loaded: ${dealersList.length} (Phones: ${phoneMap.size}, GSTINs: ${gstMap.size}, Names: ${nameMap.size})`);

        // Fetch existing products
        const [productsList] = await connection.query(`SELECT product_id, name, sku, selling_price, dealer_price FROM products`);
        const skuMap = new Map();
        const productNameMap = new Map();

        productsList.forEach(p => {
            if (p.sku) skuMap.set(String(p.sku).trim().toUpperCase(), p);
            if (p.name) productNameMap.set(String(p.name).trim().toLowerCase(), p);
        });

        console.log(`Existing Products Loaded: ${productsList.length}`);

        // Read Excel / CSV file using ExcelJS
        const workbook = new ExcelJS.Workbook();
        if (filePath.endsWith('.csv')) {
            await workbook.csv.readFile(filePath);
        } else {
            await workbook.xlsx.readFile(filePath);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            console.error('ERROR: No worksheet found in the specified file.');
            process.exit(1);
        }

        // Map column headers
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            const val = cell.value ? String(cell.value).trim() : '';
            headers[colNumber] = val;
        });

        console.log(`\nDetected Columns (${headers.filter(Boolean).length}): ${headers.filter(Boolean).slice(0, 10).join(', ')}...`);

        // Helper to extract cell value by candidate header names
        function getCellValue(row, candidateNames) {
            for (let i = 1; i < headers.length; i++) {
                const h = headers[i];
                if (!h) continue;
                const match = candidateNames.some(cn => h.toLowerCase() === cn.toLowerCase() || h.toLowerCase().includes(cn.toLowerCase()));
                if (match) {
                    const cell = row.getCell(i);
                    if (cell && cell.value !== null && cell.value !== undefined) {
                        if (typeof cell.value === 'object' && cell.value.result !== undefined) {
                            return cell.value.result;
                        }
                        if (typeof cell.value === 'object' && cell.value.text !== undefined) {
                            return cell.value.text;
                        }
                        return cell.value;
                    }
                }
            }
            return null;
        }

        let totalRowsParsed = 0;
        let matchedByPhone = 0;
        let matchedByGst = 0;
        let matchedByVrl = 0;
        let matchedByName = 0;
        let autoCreatedDealers = 0;
        let unmatchedDealers = 0;
        let ordersImported = 0;
        let itemsImported = 0;
        let totalValueImported = 0;

        const affectedDealerIds = new Set();

        if (!options.dryRun) {
            await connection.beginTransaction();
        }

        const totalRowCount = worksheet.rowCount - 1; // Subtract header
        console.log(`Processing ${totalRowCount} records...\n`);

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (!row || !row.values || row.values.length === 0) continue;

            const firmNameRaw = getCellValue(row, ['Firm Name', 'Shop Name', 'Dealer Name', 'Dealer', 'Firm', 'Customer Name', 'DEALER NAME', 'FIRM NAME']) || '';
            const contactPersonRaw = getCellValue(row, ['Contact Person', 'Owner Name', 'Dealer Owner', 'Contact', 'CONTACT PERSON']) || '';
            const phoneRaw = getCellValue(row, ['Dealer Phone', 'Phone', 'Phone Number', 'Contact Number', 'Mobile', 'PHONE', 'MOBILE']) || '';
            const gstRaw = getCellValue(row, ['GST No', 'GSTIN', 'GST Number', 'GST NO', 'GST']) || '';
            const vrlCodeRaw = getCellValue(row, ['VRL Code', 'Dealer Code', 'Code', 'VRL']) || '';
            
            const cityRaw = getCellValue(row, ['City', 'District', 'Town', 'Village', 'City/District', 'TOWN/VILLAGE', 'CITY']) || '';
            const stateRaw = getCellValue(row, ['State', 'STATE']) || 'Karnataka';
            const addressRaw = getCellValue(row, ['Address', 'ADDRESS']) || '';

            const orderDateRaw = getCellValue(row, ['Order Date', 'Date', 'Created At', 'Invoice Date', 'ORDER DATE', 'DATE']);
            const statusRaw = getCellValue(row, ['Order Status', 'Status', 'ORDER STATUS']) || 'delivered';

            const productSkuRaw = getCellValue(row, ['Product SKU', 'SKU', 'Product Code']) || '';
            const productNameRaw = getCellValue(row, ['Product Name', 'Product', 'Item Name', 'Items', 'PRODUCT NAME']) || '';
            const quantityRaw = getCellValue(row, ['Quantity', 'Qty', 'QTY']) || 1;
            const unitPriceRaw = getCellValue(row, ['Unit Price', 'Price', 'Rate', 'PRICE']) || 0;
            const totalAmountRaw = getCellValue(row, ['Total Amount', 'Total', 'Amount', 'Grand Total', 'TOTAL AMOUNT']) || 0;
            const advancePaidRaw = getCellValue(row, ['Advance Paid', 'Advance', 'Paid Amount', 'ADVANCE']) || 0;

            const firmName = String(firmNameRaw).trim();
            const contactPerson = String(contactPersonRaw).trim();
            const phone = sanitizePhone(phoneRaw);
            const gstNo = String(gstRaw).trim().toUpperCase();
            const vrlCode = String(vrlCodeRaw).trim().toUpperCase();

            // Skip empty rows
            if (!firmName && !phone && !gstNo && !totalAmountRaw) continue;
            totalRowsParsed++;

            // 1. DEALER MATCHING CASCADE
            let dealerId = null;
            let matchType = null;

            if (phone && phoneMap.has(phone)) {
                dealerId = phoneMap.get(phone);
                matchType = 'PHONE';
                matchedByPhone++;
            } else if (gstNo && gstMap.has(gstNo)) {
                dealerId = gstMap.get(gstNo);
                matchType = 'GSTIN';
                matchedByGst++;
            } else if (vrlCode && vrlMap.has(vrlCode)) {
                dealerId = vrlMap.get(vrlCode);
                matchType = 'VRL';
                matchedByVrl++;
            } else if (firmName && nameMap.has(firmName.toLowerCase())) {
                dealerId = nameMap.get(firmName.toLowerCase());
                matchType = 'NAME';
                matchedByName++;
            }

            // 2. AUTO-CREATE DEALER IF UNMATCHED
            if (!dealerId && options.autoCreateDealers) {
                const finalName = firmName || `Dealer (${phone || 'Imported'})`;
                if (!options.dryRun) {
                    const [res] = await connection.query(
                        `INSERT INTO dealers (dealer_name, contact_person, phone, gst_no, vrl_code, city, state, address, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
                        [finalName, contactPerson, phone, gstNo, vrlCode, cityRaw, stateRaw, addressRaw]
                    );
                    dealerId = res.insertId;
                    if (phone) phoneMap.set(phone, dealerId);
                    if (gstNo) gstMap.set(gstNo, dealerId);
                    if (vrlCode) vrlMap.set(vrlCode, dealerId);
                    nameMap.set(finalName.toLowerCase(), dealerId);
                } else {
                    dealerId = 999999; // Mock ID for dry run
                }
                autoCreatedDealers++;
                matchType = 'AUTO_CREATED';
            } else if (!dealerId) {
                unmatchedDealers++;
            }

            if (dealerId && dealerId !== 999999) {
                affectedDealerIds.add(dealerId);
            }

            // 3. PRODUCT & PRICING
            let matchedProduct = null;
            if (productSkuRaw && skuMap.has(String(productSkuRaw).trim().toUpperCase())) {
                matchedProduct = skuMap.get(String(productSkuRaw).trim().toUpperCase());
            } else if (productNameRaw && productNameMap.has(String(productNameRaw).trim().toLowerCase())) {
                matchedProduct = productNameMap.get(String(productNameRaw).trim().toLowerCase());
            }

            const parsedQty = Math.max(1, Math.round(parseFlexibleNumber(quantityRaw, 1)));
            let parsedPrice = parseFlexibleNumber(unitPriceRaw, 0);
            if (parsedPrice === 0 && matchedProduct) {
                parsedPrice = parseFlexibleNumber(matchedProduct.dealer_price || matchedProduct.selling_price, 0);
            }

            let parsedTotal = parseFlexibleNumber(totalAmountRaw, 0);
            if (parsedPrice === 0 && parsedTotal > 0 && parsedQty > 0) {
                parsedPrice = parsedTotal / parsedQty;
            }
            if (parsedTotal === 0) {
                parsedTotal = parsedPrice * parsedQty;
            }

            const parsedAdvance = Math.min(parsedTotal, Math.max(0, parseFlexibleNumber(advancePaidRaw, 0)));
            const parsedBalance = Math.max(0, parsedTotal - parsedAdvance);

            const parsedOrderDate = parseOrderDate(orderDateRaw);
            const formattedDate = formatMySqlDateTime(parsedOrderDate);

            // Sanitize Order Status
            let orderStatus = normalizeOrderStatus(statusRaw);

            // 4. INSERT INTO DATABASE (IF NOT DRY-RUN)
            if (!options.dryRun && dealerId) {
                const customerName = firmName || contactPerson || 'Agri Dealer';
                const [orderRes] = await connection.query(
                    `INSERT INTO orders (
                        order_source, dealer_id, customer_name, phone, address, city, state,
                        order_status, total_amount, advance_amount, balance_amount, created_at, updated_at
                    ) VALUES ('dealer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        dealerId, customerName, phone, addressRaw, cityRaw, stateRaw,
                        orderStatus, parsedTotal, parsedAdvance, parsedBalance, formattedDate, formattedDate
                    ]
                );

                const newOrderId = orderRes.insertId;

                // Insert Order Item
                await connection.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        newOrderId,
                        matchedProduct ? matchedProduct.product_id : null,
                        parsedQty,
                        parsedPrice,
                        parsedTotal
                    ]
                );
                itemsImported++;

                // Insert Order Payment if advance paid
                if (parsedAdvance > 0) {
                    await connection.query(
                        `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
                         VALUES (?, ?, 'Bank Transfer', ?, 'Imported Advance Payment')`,
                        [newOrderId, parsedAdvance, formattedDate]
                    );
                }
            }

            ordersImported++;
            totalValueImported += parsedTotal;

            if (totalRowsParsed % 100 === 0) {
                process.stdout.write(`Processed ${totalRowsParsed}/${totalRowCount} records...\r`);
            }
        }

        if (!options.dryRun) {
            console.log('\nCommitting transaction to database...');
            await connection.commit();

            console.log(`Recalculating statuses for ${affectedDealerIds.size} dealers...`);
            for (const dId of affectedDealerIds) {
                await syncDealerStatus(dId, connection);
            }
        }

        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n====================================================');
        console.log('             MIGRATION SUMMARY REPORT               ');
        console.log('====================================================');
        console.log(`Total Rows Parsed    : ${totalRowsParsed}`);
        console.log(`Orders Processed     : ${ordersImported}`);
        console.log(`Total Revenue Value  : ₹${totalValueImported.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        console.log(`----------------------------------------------------`);
        console.log(`Matched by Phone     : ${matchedByPhone}`);
        console.log(`Matched by GSTIN     : ${matchedByGst}`);
        console.log(`Matched by VRL Code  : ${matchedByVrl}`);
        console.log(`Matched by Shop Name : ${matchedByName}`);
        console.log(`Auto-Created Dealers : ${autoCreatedDealers}`);
        console.log(`Unmatched Dealers    : ${unmatchedDealers}`);
        console.log(`Execution Time       : ${durationSec} seconds`);
        console.log('====================================================\n');

        if (options.dryRun) {
            console.log('NOTE: Dry run complete! No records were altered in your database.');
            console.log('To perform live migration, re-run without the --dry-run flag.\n');
        } else {
            console.log('SUCCESS: All orders and dealer records imported successfully into SGB CRM!\n');
        }

    } catch (err) {
        if (!options.dryRun && connection) {
            await connection.rollback();
        }
        console.error('\nERROR: Migration failed:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

bulkMigrateOrders();

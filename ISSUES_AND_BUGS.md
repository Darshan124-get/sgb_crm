# SGB AGRO CRM - ISSUES, BUGS & TECHNICAL DEBT

---

## ISSUE SEVERITY LEVELS

- **CRITICAL:** System down, Security breach, Data loss risk
- **HIGH:** Major feature broken, Performance degradation, Security vulnerability
- **MEDIUM:** Feature partially broken, Workaround exists, Performance impact
- **LOW:** Minor issue, No workaround needed, Edge case only

---

## ISSUED DETAILED ANALYSIS

### CRITICAL ISSUES (0️⃣ CRITICAL)

#### 1. Insufficient Input Validation & SQL Injection Risk
**Severity:** CRITICAL  
**Location:** search.controller.js, lead.controller.js, order.controller.js  
**Description:**
- Global input sanitization for `LIKE` queries in search controllers is missing, posing an SQL Injection risk.
- Phone number and email formats not strictly validated everywhere.
- Prices/amounts not strictly validated for positive numbers.

**Impact:**
- SQL Injection possible via unescaped characters in `LIKE` queries (`%` and `_`).
- Data corruption (invalid formats stored).
- Business logic broken (negative prices, null amounts).

**Example - Search Controller:**
```javascript
// CURRENT - VULNERABLE TO WILDCARD INJECTION
const searchTerm = req.query.q;
await connection.query('SELECT * FROM leads WHERE customer_name LIKE ?', [`%${searchTerm}%`]);

// NEEDED - ESCAPED WILDCARDS
const escapedTerm = searchTerm.replace(/[%_]/g, '\\$&');
await connection.query('SELECT * FROM leads WHERE customer_name LIKE ?', [`%${escapedTerm}%`]);
```

**Fix Required:**
- Add global sanitization middleware for search inputs.
- Use `express-validator` or `joi` to strictly enforce schema for all POST/PUT/PATCH requests.

---

#### 2. File Upload Security Vulnerability
**Severity:** CRITICAL  
**Location:** logistics.controller.js (payment screenshot upload path)  
**Description:**
- No file type validation (can upload .exe, .sh files)
- No file size limit (can upload 1GB+ files)
- No filename sanitization (path traversal possible)
- Files stored in predictable /uploads directory
- No antivirus scan on uploaded files

**Impact:**
- Malicious code execution (upload .php, .js files)
- Server disk full attack (DOS)
- Arbitrary file access (path traversal: ../../../etc/passwd)
- System compromise

**Current Code:**
```javascript
// NO UPLOAD HANDLER SHOWN - FILES ACCEPTED BUT NO VALIDATION
await pool.query(
    'INSERT INTO lead_advance_payments (screenshot_url, ...) VALUES (?, ...)',
    [req.body.screenshot_url]  // No validation
);
```

**Fix Required:**
```javascript
const multer = require('multer');
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});
```

---

#### 3. Rate Limiting & Security Headers
**Severity:** ✅ RESOLVED (Was: CRITICAL)  
**Location:** app.js (Global Middleware)  
**Description:**
- **Status:** Fixed. System is no longer vulnerable to basic brute force or DDoS due to lack of rate limiting.
- **Implementation:** `express-rate-limit` has been applied globally (1000 requests per 15 minutes).
- **Security Hardening:** `helmet` is active to secure HTTP headers, and `compression` is added for payload optimization.

---

#### 4. JWT Secret Hardcoded Fallback
**Severity:** CRITICAL (Security)  
**Location:** auth.controller.js, auth.middleware.js  
**Description:**
- Default JWT secret is 'secret' if env variable missing
- Anyone can forge tokens if they know the fallback
- No warning if secret not set in production

**Impact:**
- Attacker can create fake JWT tokens
- Can impersonate any user
- Complete authentication bypass

**Current Code:**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'secret'; // ⚠️ BAD
```

**Fix Required:**
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in environment variables');
}
```

---

### HIGH SEVERITY ISSUES (🔴 HIGH)

#### 5. XSS Vulnerability - localStorage Token Storage
**Severity:** HIGH (Security)  
**Location:** frontend/js/script.js  
**Description:**
- JWT token stored in localStorage (vulnerable to XSS)
- localStorage accessible to any JavaScript on page
- If malicious script injected, can steal token
- Token not cleared on XSS attack

**Current Code:**
```javascript
// VULNERABLE
localStorage.setItem('token', data.token); // Accessible to XSS
localStorage.setItem('user', JSON.stringify(data.user));
```

**Impact:**
- Session hijacking via XSS
- Attacker can access user's data
- Impersonation of user

**Fix Required:**
```javascript
// Use HttpOnly cookies instead (requires backend change)
// Or: Implement Content Security Policy (CSP)
// Or: Add CSRF tokens for mutations
```

---

#### 6. No CSRF Protection
**Severity:** HIGH (Security)  
**Location:** All POST/PUT/DELETE routes  
**Description:**
- No CSRF tokens on requests
- Forms can be submitted from malicious sites
- Attacker can perform actions as authenticated user

**Impact:**
- Unauthorized order creation
- Unauthorized lead deletion
- Account compromise

**Fix Required:**
```javascript
const csrf = require('csurf');
app.use(csrf({ cookie: false })); // Token in session
app.post('/api/orders', csrfProtection, ...);
```

---

#### 7. No API Pagination - Performance Issue
**Severity:** HIGH (Performance)  
**Location:** All GET endpoints (/api/leads, /api/orders, /api/products, etc)  
**Description:**
- All list endpoints return ALL records regardless of count
- No limit/offset or page parameters
- With 100k leads, entire dataset loaded into memory
- Causes OOM errors and slow response times
- No way to implement infinite scroll

**Current Code:**
```javascript
// RETURNS ALL RECORDS
exports.getLeads = async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(rows); // All 50,000 leads returned
};
```

**Impact:**
- Memory overflow with large datasets
- Slow API response times (>30s)
- Frontend GUI freezes
- Cannot load page with large lead count

**Fix Required:**
```javascript
exports.getLeads = async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
        'SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
    );
    res.json(rows);
};
```

---

#### 8. No Database Indexes on Frequently Filtered Columns
**Severity:** HIGH (Performance)  
**Location:** MySQL database schema (init_db.sql)  
**Description:**
- Columns used in WHERE clauses have no indexes
- Examples: phone_number, email, status, assigned_to
- Query performance is O(n) - full table scan
- Performance degrades with dataset size

**Current Queries Without Index:**
```sql
SELECT * FROM leads WHERE phone_number = ?;  -- No index on phone_number
SELECT * FROM orders WHERE order_status = ?;  -- No index on order_status
SELECT * FROM leads WHERE assigned_to = ?;  -- No index on assigned_to
```

**Impact:**
- Single lead lookup takes 0.5s with 100k leads
- Dashboard query takes 30+ seconds
- Database CPU 100% usage

**Fix Required:**
```sql
ALTER TABLE leads ADD INDEX idx_phone_number (phone_number);
ALTER TABLE leads ADD INDEX idx_status (status);
ALTER TABLE leads ADD INDEX idx_assigned_to (assigned_to);
ALTER TABLE orders ADD INDEX idx_order_status (order_status);
ALTER TABLE orders ADD INDEX idx_lead_id (lead_id);
ALTER TABLE products ADD INDEX idx_sku (sku);
ALTER TABLE users ADD INDEX idx_email (email);
```

---

#### 9. No Server-Side Session Revocation / Logout Endpoint
**Severity:** HIGH (Security)  
**Location:** auth.routes.js, auth.controller.js  
**Description:**
- No server-side session revocation endpoint exists.
- Token relies purely on client-side storage cleanup (`localStorage.removeItem`).
- Token remains valid on the server until its 8-hour expiry is reached.

**Impact:**
- Stolen tokens cannot be revoked before their expiry.
- Users cannot force a logout of active sessions across multiple devices.

**Fix Required:**
- Implement a server-side token blacklist (e.g., using Redis) or migrate to session-based auth.
- Create a `POST /api/auth/logout` endpoint to add the current token to the invalidation list.

---

#### 10. Hard Delete Users - Data Loss & Compliance Issue
**Severity:** HIGH  
**Location:** user.controller.js, order.controller.js, lead.controller.js  
**Description:**
- DELETE operations permanently remove records
- No soft delete with deleted_at timestamp
- Deleted user leaves orphaned orders/leads
- Violates compliance (GDPR requires audit trail)
- No way to recover deleted data

**Current Code:**
```javascript
exports.deleteUser = async (req, res) => {
    await db.execute('DELETE FROM users WHERE user_id = ?', [id]); // PERMANENT DELETION
};

exports.deleteLead = async (req, res) => {
    await pool.query('DELETE FROM leads WHERE lead_id = ?', [req.params.id]); // PERMANENT
};
```

**Impact:**
- Accidental deletion can't be undone
- Orphaned related records
- No audit trail for compliance
- Customer data loss

**Fix Required:**
```javascript
// Add soft delete column
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

// Update to soft delete
exports.deleteUser = async (req, res) => {
    await db.execute('UPDATE users SET deleted_at = NOW() WHERE user_id = ?', [id]);
};

// Queries automatically exclude soft-deleted
"SELECT * FROM leads WHERE deleted_at IS NULL"
```

---

#### 11. No Atomic Transactions for Inventory Reservation
**Severity:** HIGH (Business Logic)  
**Location:** order.controller.js  
**Description:**
- When an order is created, inventory is not safely reserved using atomic database transactions.
- Lack of transaction isolation (`BEGIN`, `COMMIT`, `ROLLBACK`) means race conditions can occur.
- Multiple simultaneous orders can oversell the same stock.

**Impact:**
- Overselling/double booking under concurrent load.
- Fulfillment issues and financial losses.
- Inconsistent database state if a query fails mid-execution.

**Fix Required:**
- Transition `order.controller.js` to use formal atomic database transactions for inventory reservation.
- Example:
```javascript
const conn = await pool.getConnection();
await conn.beginTransaction();
try {
    // 1. Lock rows for update: SELECT ... FOR UPDATE
    // 2. Check stock availability
    // 3. Insert order
    // 4. Update reserved_stock
    await conn.commit();
} catch (error) {
    await conn.rollback();
    throw error;
} finally {
    conn.release();
}
```

---

### MEDIUM SEVERITY ISSUES (🟠 MEDIUM)

#### 12. Duplicate Lead Detection Only on Create
**Severity:** MEDIUM  
**Location:** lead.controller.js  
**Description:**
- Duplicate phone check only on create
- Updating lead phone to duplicate number is allowed
- Two leads can end up with same phone (if one updated)

**Current Code:**
```javascript
exports.createLead = async (req, res) => {
    const [existing] = await connection.query(
        'SELECT lead_id FROM leads WHERE phone_number = ?',
        [phone_number]
    );
    if (existing.length > 0) {
        return res.status(400).json({ message: 'Lead exists' });
    }
};

exports.updateLead = async (req, res) => {
    // ❌ NO DUPLICATE CHECK HERE
    await connection.query(
        'UPDATE leads SET phone_number = ? WHERE lead_id = ?',
        [req.body.phone_number, req.params.id]
    );
};
```

**Impact:**
- Data integrity issue
- System expects unique phone numbers

**Fix Required:**
```javascript
exports.updateLead = async (req, res) => {
    if (req.body.phone_number) {
        const [existing] = await connection.query(
            'SELECT lead_id FROM leads WHERE phone_number = ? AND lead_id != ?',
            [req.body.phone_number, req.params.id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Phone already exists' });
        }
    }
    // Update lead
};
```

---

#### 13. Lead Auto-Assignment Logic Flawed
**Severity:** MEDIUM  
**Location:** lead.controller.js  
**Description:**
- Uses JWT's user.updated_at to track last assignment
- updated_at changes even if user just logs in (unrelated to assignment)
- Does not accurately reflect assignment load
- User not used for assignment doesn't get leads, even if inactive

**Current Implementation:**
```javascript
const [salesStaff] = await connection.query(
    `SELECT u.user_id FROM users u 
     JOIN roles r ON u.role_id = r.role_id 
     WHERE r.name = 'sales' AND u.language = ? AND u.status = 'active'
     ORDER BY u.updated_at ASC LIMIT 1`,  // ⚠️ Uses general updated_at
    [language]
);

// Update used incorrectly - touches all timestamps
if (salesStaff.length > 0) {
    assignedTo = salesStaff[0].user_id;
    await connection.query(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',  // ⚠️ Bad logic
        [assignedTo]
    );
}
```

**Impact:**
- Unequal lead distribution
- Active users get few leads, inactive get many
- Doesn't reflect actual workload

**Fix Required:**
```javascript
// Add assignment_count field to track actual assignments
const [salesStaff] = await connection.query(
    `SELECT u.user_id, COUNT(l.lead_id) as lead_count
     FROM users u
     LEFT JOIN leads l ON u.user_id = l.assigned_to AND MONTH(l.created_at) = MONTH(CURDATE())
     JOIN roles r ON u.role_id = r.role_id
     WHERE r.name = 'sales' AND u.language = ? AND u.status = 'active'
     GROUP BY u.user_id
     ORDER BY lead_count ASC LIMIT 1`,
    [language]
);
```

---

#### 14. Status Transition Rules Not Enforced
**Severity:** MEDIUM (Business Logic)  
**Location:** order.controller.js  
**Description:**
- Order status can transition in invalid ways
- Can skip states (draft → shipped, skipping billed & packed)
- Can go backwards (delivered → draft)
- No validation of valid state transitions

**Current Code:**
```javascript
exports.updateStatus = async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [status, req.params.id]);
    // ❌ No validation of valid transitions
};
```

**Valid Transitions:**
```
draft → billed → packed → shipped → delivered
      ↘ cancelled (from any state)
```

**Invalid But Currently Allowed:**
```
draft → shipped (skips billed & packed)
delivered → draft (backwards)
packed → billed (backwards)
```

**Impact:**
- Order state confusion
- Financial discrepancies
- Billing/packing/shipping order issues

**Fix Required:**
```javascript
const VALID_TRANSITIONS = {
    draft: ['billed', 'cancelled'],
    billed: ['packed', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
};

exports.updateStatus = async (req, res) => {
    const [order] = await pool.query('SELECT order_status FROM orders WHERE order_id = ?', [req.params.id]);
    const newStatus = req.body.status;
    
    if (!VALID_TRANSITIONS[order[0].order_status].includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid status transition' });
    }
    
    await pool.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [newStatus, req.params.id]);
};
```

---

#### 15. No Inventory Indexes - Performance Issue
**Severity:** MEDIUM (Performance)  
**Location:** init_db.sql  
**Description:**
- Inventory queries check all 1000+ products
- O(n) lookup time for inventory checks
- Blocks order creation during inventory checks

**Missing Indexes:**
```sql
CREATE INDEX idx_product_sku ON products(sku);
CREATE INDEX idx_inventory_product ON inventory(product_id);
```

**Fix Required:**
```sql
ALTER TABLE products ADD INDEX idx_sku (sku);
ALTER TABLE inventory ADD INDEX idx_product_id (product_id);
ALTER TABLE order_items ADD INDEX idx_order_id (order_id);
ALTER TABLE order_items ADD INDEX idx_product_id (product_id);
```

---

#### 16. Followup Dates Can Be Set to Past Dates
**Severity:** MEDIUM  
**Location:** lead.controller.js  
**Description:**
- No validation that followup_date is in future
- Can create followups for past dates
- Dashboard shows already-overdue items created today

**Impact:**
- Confusing UI
- Urgent alerts for old dates
- Bad UX

**Fix Required:**
```javascript
exports.createFollowup = async (req, res) => {
    if (new Date(req.body.followup_date) < new Date()) {
        return res.status(400).json({ error: 'Followup date must be in future' });
    }
};
```

---

#### 17. Permission Control Too Permissive
**Severity:** MEDIUM (Security)  
**Location:** auth.middleware.js  
**Description:**
- Sales role has `isAdminOrSales` permission
- Sales can update order status (should be billing only)
- Sales can pack orders (should be packing only)
- Role-based checks exist but not on all endpoints

**Current Permission Model:**
```javascript
isAdminOrSales = admin + sales can do everything
isAdmin = only admin
```

**Better Model:**
```javascript
isAdmin = admin only
isBilling = billing only
isPacking = packing only
isShipping = shipping only
isSales = sales only  ← Currently includes admin permission!
```

**Issues By Endpoint:**
```
PATCH /api/orders/:id/status    ← All roles allowed (should be role-specific)
POST /api/logistics/packing      ← All roles allowed (should be packing only)
POST /api/logistics/shipping     ← All roles allowed (should be shipping only)
```

**Impact:**
- Data integrity issues
- Unauthorized operations allowed
- Security breach

**Fix Required:**
```javascript
function isPacking(req, res, next) {
    if (req.user?.role?.toLowerCase() === 'packing') {
        next();
    } else {
        res.status(403).json({ message: 'Packing role required' });
    }
}

router.patch('/orders/:id/status', isPacking, updateStatus);
```

---

### LOW SEVERITY ISSUES (🟡 LOW)

#### 18. Lead Transfer Has No Audit Trail
**Severity:** LOW  
**Location:** lead.controller.js  
**Description:**
- When lead transferred between sales staff, no history
- Can't see who had the lead before
- Compliance issue for audit

**Fix:** Add lead_transfer_history table

---

#### 19. Multi-Language Field Not Implemented
**Severity:** LOW  
**Location:** Multiple  
**Description:**
- Users have language field (EN, HI, etc)
- but no translation system
- All text hardcoded in English

**Fix:** Implement i18n library (i18next) with translation files

---

#### 20. No Backup/Restore Documented
**Severity:** LOW  
**Location:** Database  
**Description:**
- No documented backup procedure
- No restore procedure
- No backup schedule

**Fix:** Add backup script and documentation

---

## NEW FEATURE BACKLOG & ENHANCEMENTS

#### 21. WhatsApp Two-Way Sync
**Severity:** FEATURE  
**Location:** /api/whatsapp, frontend/js/whatsapp.js  
**Description:** Implement direct synchronization of incoming WhatsApp messages to replace the remaining manual tracking components. Webhooks are receiving data, but the frontend needs a real-time websocket/polling sync for two-way chat natively in the CRM.

#### 22. UI/UX: Dark Mode & Mobile Responsiveness
**Severity:** LOW (UX)  
**Location:** CSS/Frontend  
**Description:** Roll out the planned "Dark Mode" and responsive optimizations for mobile users working in the field.

#### 23. System-Wide Audit Trail
**Severity:** MEDIUM (Compliance)  
**Location:** Global  
**Description:** Implement a global `audit_logs` table to track every modification (who, what, when) across all modules (Orders, Leads, Products) for compliance and security forensics.

---

## COMPARISON: CURRENT vs NEEDED (v1.1)

| Aspect | Current | Needed | Gap |
|--------|---------|--------|-----|
| Input Validation | Partial (Guarded) | 100% (Strict) | HIGH |
| Rate Limiting | Implemented | Implemented | ✅ RESOLVED |
| Security Headers | Implemented | Implemented | ✅ RESOLVED |
| Pagination | No | Yes (all lists) | HIGH |
| Database Indexes | 5% | 100% | HIGH |
| Soft Deletes | No | Yes | MEDIUM |
| Audit Logging | No | Yes | MEDIUM |
| CSRF Protection | No | Yes | HIGH |
| Inventory Transactions| Non-Atomic | Atomic (ACID) | HIGH |
| Status Transitions | Dynamic (Sales Engine)| Dynamic (Sales Engine)| ✅ RESOLVED |
| Error Handling | Basic | Comprehensive | MEDIUM |
| Session Revocation | No | Yes (Logout Endpoint)| HIGH |
| Performance Monitoring | None | APM tool / Logging | LOW |

---

## IMMEDIATE ACTION ITEMS (Priority Order)

### Phase 1: Security & Stability (Next Sprint)
1. **Inventory Integrity:** Transition `order.controller.js` to use formal atomic database transactions for inventory reservation. (HIGH)
2. **Input Sanitization:** Add global sanitization for `LIKE` queries to mitigate SQL injection risks. (CRITICAL)
3. **Session Management:** Implement a robust JWT invalidation/logout mechanism. (HIGH)
4. **File Validation:** Implement strict file-type validation on uploaded evidence files. (CRITICAL)

### Phase 2: Compliance & Performance
5. **Audit Trail:** Implement a global `audit_logs` table for all modifications. (MEDIUM)
6. **WhatsApp Sync:** Finalize two-way real-time sync for WhatsApp messages. (FEATURE)
7. **Database Indexes:** Add explicit indexes for frequently filtered columns. (HIGH)
8. **Pagination:** Add pagination to all list API endpoints to prevent OOM errors. (HIGH)

### Phase 3: UX & Observability
9. **UI/UX Refinements:** Roll out "Dark Mode" and mobile-responsive UI. (LOW)
10. **Monitoring Integration:** Integrate a simple APM/logging solution to monitor API performance and rate-limit hits. (LOW)

---

**Last Updated:** June 02, 2026  
**Status:** Analysis Complete - Production V1.1 Readiness Reviewed

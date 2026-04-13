# SGB AGRO CRM - QUICK REFERENCE TABLES

---

## MODULES & FEATURES MATRIX

| Module | User Role | Features | Status |
|--------|-----------|----------|--------|
| **Authentication** | All | Login/Logout, JWT Tokens, Role-based Redirect | ✅ Implemented |
| | | Session Management, Password Reset | ✅ Implemented |
| **Lead Management** | Sales/Admin | Create Lead, List, Filter, Update, Delete | ✅ Implemented |
| | | Auto-assignment by language (Round-robin) | ✅ Implemented |
| | | Lead Transfer between staff | ✅ Implemented |
| | | Lead Status Tracking (8 stages) | ✅ Implemented |
| | | Notes & Comments on Leads | ✅ Implemented |
| | | Followup Scheduling | ✅ Implemented |
| | | Advance Payment Tracking & Verification | ✅ Implemented |
| | | Interest/Requirement Capture | ✅ Implemented |
| **Order Management** | Sales/Admin | Create from Lead or Dealer | ✅ Implemented |
| | | Status Tracking (Draft→Delivered) | ✅ Implemented |
| | | Order Items & Line Items | ✅ Implemented |
| | | Price Calculation (Auto Total) | ✅ Implemented |
| **Inventory** | Admin | Product CRUD (Create/Read/Update/Delete) | ✅ Implemented |
| | | Dual Pricing (Selling & Dealer) | ✅ Implemented |
| | | Stock Tracking (Current & Reserved) | ✅ Implemented |
| | | Inventory Logs (Audit Trail) | ✅ Implemented |
| | | Stock Alerts (Min Threshold) | ✅ Implemented |
| **Billing** | Billing/Admin | Invoice Generation (GST-Compliant) | ⚠️ Partial |
| | | CGST/SGST/IGST Tax Calculation | ⚠️ Manual Entry |
| | | Payment Status Tracking | ✅ Implemented |
| **Packing** | Packing/Admin | Mark Orders as Packed | ✅ Implemented |
| | | Pack Records & Remarks | ✅ Implemented |
| **Shipping** | Shipping/Admin | Record Shipments with Tracking | ✅ Implemented |
| | | Courier Integration (Tracking) | ⚠️ Manual Entry |
| **Reporting** | Admin/All | Dashboard KPIs | ✅ Implemented |
| | | Lead Export (Excel) | ✅ Implemented |
| | | Order Export (Excel) | ✅ Implemented |
| | | Sales Pipeline Visualization | ⚠️ Partial |
| **User Management** | Admin | Create/Edit/Delete Staff | ✅ Implemented |
| | | Role Assignment | ✅ Implemented |
| | | Language Support | ✅ Implemented |
| | | Staff Metrics (Leads, Conversions) | ✅ Implemented |
| **Search** | All | Global Search (3 entities) | ✅ Implemented |
| | | Lead Search | ✅ Implemented |
| | | Product Search | ✅ Implemented |
| | | User Search | ✅ Implemented |

---

## API ENDPOINTS STATUS

| Method | Endpoint | Auth | Role | Status | Notes |
|--------|----------|------|------|--------|-------|
| POST | /api/auth/login | ❌ | All | ✅ | Email/Password auth |
| GET | /api/auth/users | ✅ | All | ✅ | Active users only |
| **LEADS** |
| GET | /api/leads | ✅ | All | ✅ | With filters |
| GET | /api/leads/stats | ✅ | All | ❌ | Route exists, no handler |
| GET | /api/leads/:id | ✅ | All | ✅ | With role check |
| POST | /api/leads | ✅ | Sales/Admin | ✅ | Auto-assignment |
| PUT | /api/leads/:id | ✅ | Sales/Admin | ✅ | Update info |
| PATCH | /api/leads/:id/assign | ✅ | Sales/Admin | ✅ | Manual assignment |
| POST | /api/leads/:id/transfer | ✅ | Sales/Admin | ✅ | Lead transfer |
| DELETE | /api/leads/:id | ✅ | Sales/Admin | ✅ | Hard delete |
| GET | /api/leads/:id/notes | ✅ | All | ✅ | Get notes |
| POST | /api/leads/:id/notes | ✅ | All | ✅ | Add note |
| **PRODUCTS** |
| GET | /api/products | ✅ | All | ✅ | All products |
| POST | /api/products | ✅ | Admin | ✅ | Create product |
| PUT | /api/products/:id | ✅ | Admin | ✅ | Update product |
| DELETE | /api/products/:id | ✅ | Admin | ✅ | Delete product |
| **DEALERS** |
| GET | /api/dealers | ✅ | All | ✅ | All dealers |
| POST | /api/dealers | ✅ | Admin | ✅ | Create dealer |
| PUT | /api/dealers/:id | ✅ | Admin | ✅ | Update dealer |
| DELETE | /api/dealers/:id | ✅ | Admin | ✅ | Delete dealer |
| **ORDERS** |
| GET | /api/orders | ✅ | All | ✅ | With items breakdown |
| POST | /api/orders/convert | ✅ | Sales/Admin | ✅ | Lead→Order |
| POST | /api/orders/dealer | ✅ | Sales/Admin | ✅ | Dealer→Order |
| PATCH | /api/orders/:id/status | ✅ | All | ✅ | Update status |
| **LOGISTICS** |
| POST | /api/logistics/packing | ✅ | All | ✅ | Pack order |
| POST | /api/logistics/shipping | ✅ | All | ✅ | Ship order |
| **REPORTS** |
| GET | /api/reports/dashboard-stats | ✅ | All | ✅ | KPI dashboard |
| GET | /api/reports/leads | ✅ | All | ✅ | Excel export |
| GET | /api/reports/orders | ✅ | All | ✅ | Excel export |
| **SEARCH** |
| GET | /api/search?q=term | ✅ | All | ✅ | Multi-entity |
| **USERS** |
| GET | /api/users | ✅ | All | ✅ | All staff |
| POST | /api/users | ✅ | Admin | ✅ | Create staff |
| PUT | /api/users/:id | ✅ | Admin | ✅ | Update staff |
| DELETE | /api/users/:id | ✅ | Admin | ✅ | Delete staff |
| PATCH | /api/users/:id/password | ✅ | Admin | ✅ | Reset password |
| GET | /api/users/roles | ✅ | Admin | ⚠️ | Not implemented |

---

## DATABASE TABLES OVERVIEW

| Table | Rows Est. | Primary Purpose | Key Relations |
|-------|-----------|-----------------|----------------|
| **roles** | 5 | Role definitions | → users |
| **users** | 50-500 | Staff/Employees | ← roles, → leads, orders, etc |
| **leads** | 1000-10000 | Customer prospects | → users, ← orders |
| **lead_messages** | 5000+ | WhatsApp history | → leads |
| **lead_notes** | 2000+ | Internal comments | → leads, users |
| **lead_followups** | 3000+ | Scheduled followups | → leads, users |
| **lead_interest** | 1000+ | Product interests | → leads, products |
| **lead_advance_payments** | 500+ | Partial payments | → leads, users |
| **dealers** | 100-500 | Wholesale partners | ← orders |
| **products** | 100-1000 | Inventory items | → lead_interest, orders |
| **inventory** | 100-1000 | Stock levels | → products |
| **inventory_logs** | 5000+ | Stock audit trail | → products |
| **orders** | 500-5000 | Customer orders | ↔ leads/dealers, → order_items, invoices |
| **order_items** | 2000-20000 | Line items | → orders, products |
| **invoices** | 500-5000 | GST bills | → orders, → invoice_items |
| **invoice_items** | 2000-20000 | Invoice line items | → invoices, products |
| **packing** | 500-5000 | Warehouse records | → orders, users |
| **shipments** | 500-5000 | Shipping records | → orders, users |

---

## USER ROLES & PERMISSIONS

| Permission | Admin | Sales | Billing | Packing | Shipping |
|------------|-------|-------|---------|---------|----------|
| Create Lead | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Leads | ✅ | ❌* | ❌ | ❌ | ❌ |
| Update Lead | ✅ | ✅* | ❌ | ❌ | ❌ |
| Convert Lead→Order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Dealer Order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Order Status | ✅ | ✅** | ✅** | ✅** | ✅** |
| Create Product | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Inventory | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate Invoice | ✅ | ❌ | ✅ | ❌ | ❌ |
| Pack Order | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ship Order | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export Data | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Staff | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |

\* Sales users only see their own assigned leads
\*\* Role-based status updates (not enforced)

---

## LEAD STATUS LIFECYCLE

```
NEW (Initial)
    ↓
ASSIGNED (To sales person)
    ↓
CONTACTED (First contact made)
    ↓ →(If not interested)→ NOT_INTERESTED (End state: Lost)
    ↓ →(If interested)→ INTERESTED
    ↓ 
    ├→ FOLLOWUP (Awaiting next action)
    ├→ CONVERTED (Converted to Order) → Orders table
    └→ LOST (No further action)
```

---

## ORDER STATUS LIFECYCLE

```
DRAFT (Initial - quote/estimate)
    ↓
BILLED (Invoice generated, awaiting payment)
    ↓
PACKED (Items packed in warehouse)
    ↓
SHIPPED (Handed to courier)
    ↓
DELIVERED (Customer received)

Or at any step: CANCELLED (Order cancelled)
```

---

## CRITICAL SECURITY ISSUES SUMMARY

| Risk | Severity | Impact | Recommendation |
|------|----------|--------|-----------------|
| No Input Validation | CRITICAL | SQL Injection, Data corruption | Add validation middleware |
| File Upload Unprotected | CRITICAL | Malicious file upload, System compromise | Validate file types, size limits |
| No Rate Limiting | CRITICAL | Brute force, DDoS attack | Implement rate limiting middleware |
| JWT Secret Fallback | HIGH | Token forgery if env var missing | Remove fallback, require env var |
| XSS via localStorage | HIGH | Session hijacking, Data theft | Implement CSRF tokens, HttpOnly cookies |
| No Logout Endpoint | MEDIUM | Token can't be revoked | Add token blacklist system |
| Hard Delete Users | MEDIUM | Data loss, Compliance issues | Implement soft deletes with deleted_at |
| No Audit Logging | MEDIUM | Can't trace who changed what | Add audit_trail table |
| Hardcoded DB Credentials | HIGH | Repo compromised = DB compromised | Use environment variables (done) |
| Missing HTTPS Requirement | HIGH | Password sent in plaintext | Enforce HTTPS in production |

---

## PERFORMANCE ISSUES & BOTTLENECKS

| Issue | Current State | Impact | Solution |
|-------|---------------|--------|----------|
| No Pagination | All list endpoints return ALL records | Memory overflow with 10k+ records | Add limit/offset parameters |
| No Indexes | 3 tables without indexes (leads, orders, users) | Query time degrades O(n) | Add indexes on filter columns |
| N+1 Queries | Lead list fetches user for each lead individually | 2x DB calls for each record | Use JOIN queries |
| Large Response Size | All fields returned for all records | Slow network, high bandwidth | Add field selection |
| No Caching | Same query repeated for same page | Redundant DB calls | Implement Redis caching |
| Connection Pool Size | Only 10 concurrent connections | Can bottleneck with 50+ users | Increase to 20-30 |
| Image/File Storage | No CDN, files served from /uploads | Slow delivery, wasted bandwidth | Use S3 or CDN |
| Frontend Bundle Size | No minification/bundling | Large JS files slow page load | Bundle and minify |

---

## DATA VALIDATION CHECKLIST

| Field | Validation | Current | Needed |
|-------|-----------|---------|--------|
| phone_number | Format, Length | ❌ | ✅ |
| email | Format, Unique | ❌ | ✅ |
| password | Min length, Complexity | ❌ | ✅ |
| lead_status | Enum values only | ✅ | ✅ |
| order_status | Enum values only | ✅ | ✅ |
| amount/price | Decimal range (0-9999999.99) | ❌ | ✅ |
| quantity | Positive integer only | ❌ | ✅ |
| sku | Unique, alphanumeric | ❌ | ✅ |
| gst_number | Format validation | ❌ | ✅ |
| followup_date | Future date only, not past | ❌ | ✅ |
| city/state | Valid Indian cities/states | ❌ | ⚠️ Optional |

---

## BUSINESS PROCESS FLOWS

### **Lead to Order Conversion Flow**
```
1. Lead Created (WhatsApp)
   ↓
2. Auto-assigned to Sales (Language-based)
   ↓
3. Sales Contacts Lead (status: contacted)
   ↓
4. Lead Shows Interest (status: interested)
   ↓
5. Sales Captures Interest/Requirements
   ↓
6. Sales Creates Order from Lead
   ↓
7. Order Status: DRAFT
   ↓
8. Billing Team Generates Invoice (status: billed)
   ↓
9. Packing Team Packs Items (status: packed)
   ↓
10. Shipping Team Ships (status: shipped)
    ↓
11. Customer Receives (status: delivered)
```

### **Lead Management Workflow**
```
New Lead (phone_number)
    ↓ [Duplicate Check]
    ├→ Duplicate Found: Error (return existing lead_id)
    └→ No Duplicate: Continue
    ↓
Auto-assign to Sales Staff
    ├→ Find sales person for lead's language
    ├→ Select least recently assigned one (round-robin)
    └→ Update status to "assigned"
    ↓
Sales Person Actions:
    ├→ Add Notes
    ├→ Schedule Followup
    ├→ Record Interest
    ├→ Record Advance Payment
    └→ Convert to Order
```

### **Inventory Management Flow**
```
Product Created (admin)
    ↓
Inventory Record Created (current_stock: 0)
    ↓
Stock Additions
    ├→ Purchase Order In (inventory_log: type=in)
    ├→ Received Qty → current_stock
    ├→ If current_stock < min_alert → Alert Admin
    └→ Log created
    ↓
Stock Deductions
    ├→ Order Created (reserved_stock += qty)
    ├→ Order Packed (reserved_stock confirmed)
    ├→ Inventory Log: type=out
    ├→ current_stock -= qty
    └→ If current_stock < min_alert → Alert Admin
```

---

## DEPLOYMENT CHECKLIST

- [ ] Database created and initialized
- [ ] Seed roles executed
- [ ] Seed demo users executed
- [ ] .env file configured with DB credentials
- [ ] .env file configured with JWT secret
- [ ] npm dependencies installed
- [ ] Backend server started on port 5000
- [ ] Frontend accessible at localhost:5000
- [ ] Login works with demo user
- [ ] All API endpoints responding
- [ ] Excel export working
- [ ] Upload directory exists and writable
- [ ] CORS headers correct for frontend origin
- [ ] MySQL connection pooling verified
- [ ] Error logging configured
- [ ] HTTPS enabled in production
- [ ] Rate limiting configured
- [ ] Database backups scheduled
- [ ] Monitoring dashboards set up
- [ ] Team trained on system

---

## FILE UPLOAD LIMITS

```
JSON Payload: 50MB (configured in app.js)
URL-encoded Payload: 50MB (configured in app.js)
Individual File: No limit set (⚠️ Vulnerability)
Upload Directory: /uploads/ (⚠️ Not accessed from frontend)
File Types: No validation (⚠️ Vulnerability)
File Names: Not sanitized (⚠️ Vulnerability)
```

---

## CONTACT & ROLES

```
Recommended Team Structure:
- 1x Admin (System owner, settings, staff management)
- 2-5x Sales (Lead management, order conversion)
- 1x Billing (Invoice generation, payment tracking)
- 1x Packing (Warehouse operations)
- 1x Shipping (Logistics, courier coordination)
- 1x Super-Admin (Backup for admin)
```

---

## QUICK START COMMANDS

```bash
# Install backend
cd backend && npm install

# Database setup
mysql -u root -p < init_db.sql
node seed_executor.js

# Start backend
npm start                    # Production
npm run dev                  # Development with nodemon

# Frontend access
http://localhost:5000       # After backend started
```

---

**Document Generated:** April 11, 2026
**Version:** 1.0 Complete Analysis
**Status:** Ready for Development/Deployment

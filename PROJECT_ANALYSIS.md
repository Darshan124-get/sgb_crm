# SGB AGRO CRM - COMPLETE PROJECT ANALYSIS

---

## 1. PROJECT OVERVIEW

**Project Name:** SGB Agro CRM  
**Type:** Enterprise Agricultural Management System (Lead & Order Management Platform)  
**Architecture:** 3-Tier Web Application (Frontend + Backend API + MySQL Database)  
**Tech Stack:**
- Backend: Node.js + Express.js
- Frontend: Vanilla JavaScript + HTML/CSS
- Database: MySQL 8.0
- Middleware: Express, JWT Auth, CORS
- Libraries: ExcelJS, bcryptjs, multer

**Purpose:**
- Manage agricultural customer leads via WhatsApp
- Convert leads to orders
- Manage inventory and products
- Handle billing with GST invoices
- Track packing and shipping logistics
- Multi-role user access control

---

## 2. COMPLETE PROJECT STRUCTURE

```
d:\sgb scratch\
├── backend/
│   ├── server.js                    [Main Entry Point - Starts Express Server]
│   ├── package.json                 [Dependencies: express, mysql2, bcryptjs, jwt, multer, exceljs]
│   ├── init_db.sql                  [Database Schema & Table Structure]
│   ├── seed_roles.sql               [Initial Role Data]
│   ├── seed_demo_data.sql           [Demo User & Test Data]
│   ├── seed_executor.js             [Database Seeding Script]
│   ├── src/
│   │   ├── app.js                   [Express App Configuration - Route Mounting, Middleware Setup]
│   │   ├── config/
│   │   │   └── db.js                [MySQL Connection Pool Configuration]
│   │   ├── routes/
│   │   │   ├── auth.routes.js       [Auth: Login, Get Active Users]
│   │   │   ├── lead.routes.js       [Lead: CRUD + Notes + Assignment + Transfer]
│   │   │   ├── product.routes.js    [Product: Inventory CRUD]
│   │   │   ├── dealer.routes.js     [Dealer: Information Management]
│   │   │   ├── order.routes.js      [Order: Create, Convert Lead→Order, Update Status]
│   │   │   ├── logistics.routes.js  [Packing & Shipping Status Updates]
│   │   │   ├── report.routes.js     [Reports: Dashboard Stats, Excel Export]
│   │   │   ├── search.routes.js     [Global Search: Leads, Products, Users]
│   │   │   └── user.routes.js       [User/Staff Management: CRUD + Password Reset]
│   │   ├── controllers/
│   │   │   ├── auth.controller.js   [Login Logic, JWT Token Generation]
│   │   │   ├── lead.controller.js   [Lead Management: Create, Filter, Assign, Transfer]
│   │   │   ├── product.controller.js [Product CRUD Operations]
│   │   │   ├── dealer.controller.js [Dealer CRUD Operations]
│   │   │   ├── order.controller.js  [Order Creation, Lead Conversion, Status Updates]
│   │   │   ├── logistics.controller.js [Packing & Shipping Record Creation]
│   │   │   ├── report.controller.js [Dashboard Stats, Excel Export Logic]
│   │   │   ├── search.controller.js [Multi-entity Global Search Implementation]
│   │   │   └── user.controller.js   [Staff CRUD, Role Management, Password Reset]
│   │   └── middleware/
│   │       └── auth.middleware.js   [JWT Verification, Role-Based Access Control]
│   └── uploads/                     [Directory for File Uploads]
│
└── frontend/
    ├── index.html                   [Login Page]
    ├── css/
    │   └── styles.css               [Global Styling & Responsive Design]
    ├── js/
    │   ├── config.js                [Global Config: BASE_URL, ROOT_PATH, Role Redirects]
    │   ├── script.js                [Login Handling, Authentication Logic]
    │   ├── components.js            [Sidebar Launcher, Component Loader, Global Search]
    │   ├── dashboard-logic.js       [Dashboard Stats & Chart Rendering]
    │   ├── dashboard.js             [Dashboard Page Logic]
    │   ├── dealers.js               [Dealer Management Frontend]
    │   ├── inventory.js             [Inventory Management Frontend]
    │   ├── packaging.js             [Packing Module Frontend]
    │   ├── reports.js               [Reports & Analytics Frontend]
    │   ├── shipment.js              [Shipping & Logistics Frontend]
    │   └── users.js                 [User Management & Staff Directory]
    ├── components/
    │   ├── followup-view.html       [Followup Scheduling Component]
    │   ├── lead-details.html        [Lead Detail View Component]
    │   ├── lead-list.html           [Lead Listing Component]
    │   ├── lead-nav.html            [Lead Navigation Component]
    │   ├── manual-lead-form.html    [Lead Creation Form Component]
    │   ├── schedule-view.html       [Schedule View Component]
    │   ├── sidebar-admin.html       [Admin Dashboard Sidebar]
    │   ├── sidebar-billing.html     [Billing Module Sidebar]
    │   ├── sidebar-packing.html     [Packing Module Sidebar]
    │   ├── sidebar-sales.html       [Sales Module Sidebar]
    │   └── sidebar-shipping.html    [Shipping Module Sidebar]
    └── modules/
        ├── admin/                   [Admin Dashboard Module]
        │   ├── dashboard.html
        │   ├── dealers.html
        │   ├── inventory.html
        │   ├── leads.html
        │   ├── logs.html
        │   ├── orders.html
        │   ├── pipeline.html
        │   ├── reports.html
        │   ├── schedule.html
        │   ├── settings.html
        │   ├── users.html
        │   └── js/                  [Admin Module-Specific Logic]
        ├── billing/                 [Billing & Invoice Module]
        │   ├── billing.html
        │   ├── invoice.html
        │   └── js/billing.js
        ├── packing/                 [Packing/Warehouse Module]
        │   ├── packing.html
        │   └── js/packing.js
        ├── sales/                   [Sales Team Module]
        │   ├── activity.html
        │   ├── dashboard.html
        │   ├── dealers.html
        │   ├── leads.html
        │   ├── orders.html
        │   ├── pipeline.html
        │   ├── reports.html
        │   ├── schedule.html
        │   ├── settings.html
        │   └── js/                  [Sales Module-Specific Logic]
        └── shipping/                [Logistics & Shipping Module]
            ├── shipping.html
            └── js/shipping.js
```

---

## 3. FEATURES & FUNCTIONALITY

### 3.1 AUTHENTICATION & AUTHORIZATION
| Feature | Description | Implementation |
|---------|-------------|-----------------|
| Login System | Email & Password-based authentication | `POST /api/auth/login` → bcryptjs verification → JWT token generation |
| Token Management | 8-hour JWT expiration token | JWT signed with {id, name, role} |
| Role-Based Access | Admin, Sales, Billing, Packing, Shipping roles | Middleware: `isAdmin`, `isAdminOrSales` |
| Session Handling | Local storage token persistence | Token validated on every API request |
| Password Reset | Reset staff password by admin | `PATCH /api/users/:id/password` |
| User Status | Active/Inactive account status | Login blocked if status='inactive' |

### 3.2 LEAD MANAGEMENT (WhatsApp Integration-Ready)
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Create Lead | Add new lead with phone, customer name, message | `POST /api/leads` |
| List Leads | View all leads with filters (status, language, assigned_to) | `GET /api/leads?status=new&language=EN` |
| Lead Details | View single lead with full information | `GET /api/leads/:id` |
| Update Lead | Modify lead information | `PUT /api/leads/:id` |
| Delete Lead | Remove lead from system | `DELETE /api/leads/:id` |
| Auto-Assignment | Language-based round-robin assignment to sales staff | Logic in createLead controller |
| Lead Transfer | Transfer lead between sales staff | `POST /api/leads/:id/transfer` |
| Lead Status | Track lead: new→assigned→contacted→interested→converted→lost | ENUM field updates |
| Duplicate Prevention | Prevent duplicate phone numbers | Check before create |
| Lead Notes | Add/View notes and comments on lead | `GET/POST /api/leads/:id/notes` |
| Lead Statistics | Dashboard stats: leads today, MTD, conversion rate | `GET /api/reports/dashboard-stats` |
| Advance Payments | Track partial payments from leads | Table: lead_advance_payments with verification |
| Lead Interests | Record customer product interests | Table: lead_interest links leads to products |

### 3.3 ORDER MANAGEMENT
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Create Order From Lead | Convert interested lead to order | `POST /api/orders/convert` |
| Create Dealer Order | Create direct order from dealer | `POST /api/orders/dealer` |
| List Orders | View all orders with items breakdown | `GET /api/orders` |
| Order Statuses | Draft → Billed → Packed → Shipped → Delivered | `PATCH /api/orders/:id/status` |
| Order Items | Add products and quantities to order | Table: order_items |
| Price Calculation | Auto-calculate total, advance, balance | Formula: total_amount = Σ(qty × price) |
| Order Tracking | Track order source (lead/dealer) | order_source ENUM field |

### 3.4 PRODUCT & INVENTORY MANAGEMENT
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Product CRUD | Create, read, update delete products | `GET/POST/PUT/DELETE /api/products` |
| SKU Management | Unique Stock Keeping Unit per product | sku UNIQUE constraint |
| Pricing | Dual pricing (selling_price, dealer_price) | Fields in products table |
| Inventory Tracking | Current stock vs reserved stock | Table: inventory |
| Inventory Logs | Track all stock movements | Table: inventory_logs (in/out/adjustment) |
| Stock Alert | Minimum stock alert threshold | min_stock_alert field |
| Categories | Organize products by category | category VARCHAR field |
| Units | Define measurement units (kg, liter, etc) | unit VARCHAR field |

### 3.5 BILLING & INVOICING (GST-COMPLIANT)
| Feature | Description | Details |
|---------|-------------|---------|
| Invoice Generation | Create GST-compliant invoices | Table: invoices |
| GST Calculation | CGST, SGST, IGST support | Separate decimal fields |
| Invoice Items | Line items with product, qty, price, GST% | Table: invoice_items |
| Payment Status | Track pending/paid/partial payments | ENUM field |
| Invoice Number | Unique invoice ID generation | VARCHAR UNIQUE |
| Billing Name & Address | Separate billing info from order | billing_name, billing_address |
| Subtotal Calculation | Sum before tax | subtotal field |
| Total Amount | Grand total with all taxes | total_amount field |

### 3.6 LOGISTICS (PACKING & SHIPPING)
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Pack Order | Mark order as packed in warehouse | `POST /api/logistics/packing` |
| Packing Records | Store who packed, when, with remarks | Table: packing |
| Ship Order | Record shipment details (courier, tracking) | `POST /api/logistics/shipping` |
| Shipment Tracking | Track courier name and tracking ID | Table: shipments |
| Order Status Flow | packed → shipped state updates | Automatic status propagation |

### 3.7 USER & STAFF MANAGEMENT
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| List All Staff | View all active users with roles | `GET /api/users` |
| Create Staff | Add new user with role assignment | `POST /api/users` |
| Update Staff | Modify user details | `PUT /api/users/:id` |
| Delete Staff | Remove user from system | `DELETE /api/users/:id` |
| Language Support | Multi-language support (EN, other) | language VARCHAR field |
| Role Management | Assign roles (admin, sales, billing, packing, shipping) | role_id FK to roles table |
| Staff Metrics | Track leads handled, conversions | Calculated in getAllUsers query |
| Account Status | Active/Inactive toggle | status ENUM('active', 'inactive') |

### 3.8 REPORTING & ANALYTICS
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Dashboard Stats | KPI Cards: leads today, MTD, revenue, conversions | `GET /api/reports/dashboard-stats` |
| Lead Export | Export all leads to Excel | `GET /api/reports/leads` |
| Order Export | Export all orders to Excel | `GET /api/reports/orders` |
| Funnel Analysis | Sales pipeline view (new→interested→converted→lost) | Calculated in dashboard |
| Role-Based Filtering | Show only own leads for Sales role | Query filter in getLeads |
| Excel Generation | Generate formatted Excel reports | ExcelJS library |

### 3.9 SEARCH
| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| Global Search | Search 3 entities simultaneously | `GET /api/search?q=term` |
| Lead Search | Search by customer name or phone | LIKE query on leads table |
| Product Search | Search by product name or SKU | LIKE query on products table |
| User Search | Search by staff name | LIKE query on users table |
| Min 2 Characters | Search requires 2+ characters | Validation in controller |

---

## 4. DATABASE SCHEMA & RELATIONSHIPS

### 4.1 CORE TABLES

**ROLES** - User Role Definitions
```
role_id (INT, PK)
name (VARCHAR) UNIQUE - admin, sales, billing, packing, shipping
description (TEXT)
created_at (TIMESTAMP)
```

**USERS** - Staff/Employees
```
user_id (INT, PK)
name (VARCHAR 100)
phone (VARCHAR 20) UNIQUE
email (VARCHAR 100) UNIQUE
password_hash (VARCHAR 255) - bcryptjs hashed
role_id (INT, FK → roles)
language (VARCHAR) - EN, HI, etc
status (ENUM) - active, inactive
created_at, updated_at (TIMESTAMP)
```

**LEADS** - Customer Leads from WhatsApp
```
lead_id (INT, PK)
phone_number (VARCHAR 20) UNIQUE
first_message (TEXT)
customer_name (VARCHAR 100)
address (TEXT)
city, state (VARCHAR)
language (VARCHAR)
status (ENUM) - new, assigned, contacted, followup, interested, not_interested, converted, lost
assigned_to (INT, FK → users)
source (VARCHAR) - whatsapp
created_at, updated_at (TIMESTAMP)
```

**LEAD_MESSAGES** - WhatsApp Message History
```
message_id (INT, PK)
lead_id (INT, FK → leads)
message_type (ENUM) - incoming, outgoing
message_text (TEXT)
media_url (TEXT)
timestamp (TIMESTAMP)
```

**LEAD_NOTES** - Internal Notes on Leads
```
note_id (INT, PK)
lead_id (INT, FK → leads)
user_id (INT, FK → users)
note (TEXT)
created_at (TIMESTAMP)
```

**LEAD_FOLLOWUPS** - Follow-up Scheduling
```
followup_id (INT, PK)
lead_id (INT, FK → leads)
followup_date (DATETIME)
status (ENUM) - pending, done
remarks (TEXT)
created_by (INT, FK → users)
created_at (TIMESTAMP)
```

**LEAD_INTEREST** - Customer Interests in Products
```
interest_id (INT, PK)
lead_id (INT, FK → leads)
product_id (INT, FK → products)
crop_type (VARCHAR)
quantity_required (VARCHAR)
budget (DECIMAL)
remarks (TEXT)
created_at (TIMESTAMP)
```

**LEAD_ADVANCE_PAYMENTS** - Partial Payments from Leads
```
advance_id (INT, PK)
lead_id (INT, FK → leads)
amount (DECIMAL)
payment_mode (VARCHAR) - UPI, Bank Transfer, Cash
screenshot_url (TEXT) - proof
payment_date (DATE)
verified (ENUM) - yes, no
verified_by (INT, FK → users)
created_at (TIMESTAMP)
```

**DEALERS** - Wholesale/Retail Partners
```
dealer_id (INT, PK)
dealer_name (VARCHAR 150)
contact_person (VARCHAR 100)
phone, email (VARCHAR)
address, city, state (TEXT/VARCHAR)
created_at (TIMESTAMP)
```

**PRODUCTS** - Inventory Items
```
product_id (INT, PK)
name (VARCHAR 255)
category (VARCHAR 100) - Seeds, Fertilizer, Pesticide, etc
description (TEXT)
sku (VARCHAR 50) UNIQUE
unit (VARCHAR 20) - kg, liter, qty
selling_price (DECIMAL) - retail price
dealer_price (DECIMAL) - wholesale price
min_stock_alert (INT) - default 10
created_at (TIMESTAMP)
```

**INVENTORY** - Stock Management
```
inventory_id (INT, PK)
product_id (INT, FK → products) UNIQUE
current_stock (INT)
reserved_stock (INT)
last_updated (TIMESTAMP)
```

**INVENTORY_LOGS** - Stock Audit Trail
```
log_id (INT, PK)
product_id (INT, FK → products)
type (ENUM) - in, out, adjustment
quantity (INT)
reference_type (VARCHAR) - order, manual, return
reference_id (INT)
created_at (TIMESTAMP)
```

**ORDERS** - Customer Orders (from Leads or Dealers)
```
order_id (INT, PK)
order_source (ENUM) - lead, dealer
lead_id (INT, FK → leads, NULL)
dealer_id (INT, FK → dealers, NULL)
customer_name (VARCHAR 150)
phone, address, city, state (VARCHAR)
order_status (ENUM) - draft, billed, packed, shipped, delivered, cancelled
created_by (INT, FK → users)
billing_done_by (INT, FK → users)
total_amount (DECIMAL)
advance_amount (DECIMAL)
balance_amount (DECIMAL)
created_at, updated_at (TIMESTAMP)
```

**ORDER_ITEMS** - Products in Orders (Line Items)
```
order_item_id (INT, PK)
order_id (INT, FK → orders)
product_id (INT, FK → products)
quantity (INT)
price (DECIMAL) - unit price at time of order
total_price (DECIMAL) - quantity × price
```

**INVOICES** - GST-Compliant Billing
```
invoice_id (INT, PK)
order_id (INT, FK → orders)
invoice_number (VARCHAR 50) UNIQUE
invoice_date (DATE)
billing_name (VARCHAR 150)
billing_address (TEXT)
gst_number (VARCHAR 20)
subtotal (DECIMAL)
cgst, sgst, igst (DECIMAL) - tax components
total_amount (DECIMAL)
payment_status (ENUM) - pending, paid, partial
created_by (INT, FK → users)
created_at (TIMESTAMP)
```

**INVOICE_ITEMS** - Products in Invoices
```
invoice_item_id (INT, PK)
invoice_id (INT, FK → invoices)
product_id (INT, FK → products)
quantity (INT)
price (DECIMAL)
gst_percentage (DECIMAL)
total (DECIMAL)
```

**PACKING** - Warehouse Packing Records
```
packing_id (INT, PK)
order_id (INT, FK → orders)
packed_by (INT, FK → users)
packed_at (TIMESTAMP)
status (VARCHAR) - packed
remarks (TEXT)
```

**SHIPMENTS** - Shipping/Logistics Records
```
shipment_id (INT, PK)
order_id (INT, FK → orders)
courier_name (VARCHAR) - Delhivery, BlueDart, etc
tracking_id (VARCHAR)
shipped_by (INT, FK → users)
shipped_at (TIMESTAMP)
status (VARCHAR) - shipped
```

---

## 5. API ENDPOINTS REFERENCE

### 5.1 Authentication Routes
```
POST   /api/auth/login              Login with email & password
GET    /api/auth/users              Get all active users
```

### 5.2 Lead Routes
```
GET    /api/leads                   Get leads (with filters: status, language, assigned_to)
GET    /api/leads/stats             Get lead statistics
GET    /api/leads/:id               Get single lead details
POST   /api/leads                   Create new lead (auto-assigned by language)
PUT    /api/leads/:id               Update lead information
PATCH  /api/leads/:id/assign        Assign lead to sales staff
POST   /api/leads/:id/transfer      Transfer lead to another staff
DELETE /api/leads/:id               Delete lead
GET    /api/leads/:id/notes         Get lead notes & comments
POST   /api/leads/:id/notes         Add note to lead
```

### 5.3 Product Routes
```
GET    /api/products                Get all products
POST   /api/products                Create product (admin only)
PUT    /api/products/:id            Update product (admin only)
DELETE /api/products/:id            Delete product (admin only)
```

### 5.4 Dealer Routes
```
GET    /api/dealers                 Get all dealers
POST   /api/dealers                 Create dealer (admin only)
PUT    /api/dealers/:id             Update dealer (admin only)
DELETE /api/dealers/:id             Delete dealer (admin only)
```

### 5.5 Order Routes
```
GET    /api/orders                  Get all orders (with status filter)
POST   /api/orders/convert          Convert lead to order
POST   /api/orders/dealer           Create order directly from dealer
PATCH  /api/orders/:id/status       Update order status
```

### 5.6 Logistics Routes
```
POST   /api/logistics/packing       Mark order as packed
POST   /api/logistics/shipping      Mark order as shipped with tracking
```

### 5.7 Report Routes
```
GET    /api/reports/dashboard-stats Get KPI dashboard statistics
GET    /api/reports/leads           Export leads to Excel
GET    /api/reports/orders          Export orders to Excel
```

### 5.8 Search Routes
```
GET    /api/search?q=term           Global search (leads, products, users)
```

### 5.9 User Routes
```
GET    /api/users                   Get all staff
POST   /api/users                   Create new staff member
PUT    /api/users/:id               Update staff details
DELETE /api/users/:id               Delete staff
PATCH  /api/users/:id/password      Reset staff password
GET    /api/users/roles             Get all available roles
```

---

## 6. FRONTEND MODULES & PAGES

### 6.1 Login Module
**File:** frontend/index.html  
**Features:**
- Email & password login form
- Password visibility toggle
- Session expiration message
- Role-based redirect after login
- Error message display

### 6.2 Admin Module (frontend/modules/admin/)
| Page | File | Purpose |
|------|------|---------|
| Dashboard | dashboard.html | Overview KPIs, charts, system metrics |
| Leads | leads.html | Manage all leads, view status, assignments |
| Orders | orders.html | View/manage all orders across system |
| Dealers | dealers.html | Create/edit/delete dealer information |
| Inventory | inventory.html | Product catalog, stock levels, alerts |
| Users | users.html | Staff management, role assignment |
| Reports | reports.html | Analytics, charts, export reports |
| Pipeline | pipeline.html | Sales funnel visualization |
| Schedule | schedule.html | Calendar view of followups |
| Logs | logs.html | System activity and audit logs |
| Settings | settings.html | System configuration options |

### 6.3 Sales Module (frontend/modules/sales/)
| Page | File | Purpose |
|------|------|---------|
| Dashboard | dashboard.html | Sales personal KPIs, my leads, targets |
| Leads | leads.html | My assigned leads, creation, management |
| Orders | orders.html | My orders, conversion, status tracking |
| Dealers | dealers.html | View dealer information (read-only) |
| Activity | activity.html | Lead interactions, message history |
| Reports | reports.html | Personal performance reports |
| Pipeline | pipeline.html | My sales pipeline |
| Schedule | schedule.html | My followup calendar |
| Settings | settings.html | Personal preferences |

### 6.4 Billing Module (frontend/modules/billing/)
| Page | File | Purpose |
|------|------|---------|
| Billing | billing.html | Invoice management, payment tracking |
| Invoice | invoice.html | Create/view/print GST invoices |

### 6.5 Packing Module (frontend/modules/packing/)
| Page | File | Purpose |
|------|------|---------|
| Packing | packing.html | Pack orders, record warehouse details |

### 6.6 Shipping Module (frontend/modules/shipping/)
| Page | File | Purpose |
|------|------|---------|
| Shipping | shipping.html | Track shipments, courier integration |

### 6.7 Shared Components (frontend/components/)
| Component | File | Purpose |
|-----------|------|---------|
| Sidebar (Admin) | sidebar-admin.html | Admin navigation menu |
| Sidebar (Sales) | sidebar-sales.html | Sales navigation menu |
| Sidebar (Billing) | sidebar-billing.html | Billing navigation menu |
| Sidebar (Packing) | sidebar-packing.html | Packing navigation menu |
| Sidebar (Shipping) | sidebar-shipping.html | Shipping navigation menu |
| Lead Navigation | lead-nav.html | Lead-specific action buttons |
| Lead List | lead-list.html | Reusable lead listing component |
| Lead Details | lead-details.html | Lead information display |
| Lead Form | manual-lead-form.html | Lead creation form |
| Followup View | followup-view.html | Followup scheduling view |
| Schedule View | schedule-view.html | Calendar schedule component |

---

## 7. BACKEND ARCHITECTURE

### 7.1 Project Structure Pattern
**MVC Architecture:**
- **M** (Model): MySQL Tables defined in init_db.sql
- **V** (View): React-free vanilla JavaScript + HTML templates
- **C** (Controller): Business logic in src/controllers/

### 7.2 Request Flow
```
1. Client Request (Frontend JS)
   ↓
2. Express Router (routes/*.routes.js)
   ↓
3. Authentication Middleware (auth.middleware.js)
   ↓
4. Authorization Check (isAdmin, isAdminOrSales)
   ↓
5. Controller Handler (controllers/*.controller.js)
   ↓
6. Database Query (MySQL via pool)
   ↓
7. Response JSON → Frontend
```

### 7.3 Middleware Stack
```javascript
app.use(cors())                              // Enable CORS
app.use(express.json({limit: '50mb'}))      // JSON body parser
app.use(express.urlencoded({...}))          // URL-encoded parser
app.use('/uploads', express.static(...))    // Static file serving
app.use(express.static(...))                // Frontend static files
// Custom middleware: authenticateToken, isAdmin, isAdminOrSales
```

### 7.4 Key Implementation Details

**Transaction Support:**
- Used in order creation (convertLeadToOrder)
- Used in lead creation (auto-assignment)
- Rollback on errors

**Security Features:**
- JWT token validation on every route
- Password hashing with bcryptjs
- Role-based data filtering (Sales users only see own leads)
- SQL prepared statements (parameterized queries)

**Error Handling:**
- Try-catch blocks in all controllers
- Validation before database operations
- Meaningful error messages to frontend

**Performance Optimizations:**
- MySQL connection pooling (10 connections)
- LEFT JOINs for lead-to-user queries
- Index on commonly filtered columns (phone_number, email, status)

---

## 8. ISSUES & BUGS

### 8.1 CRITICAL ISSUES

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Missing Validation | CRITICAL | lead.controller.js | No validation on lead creation fields before DB insert. Phone format not validated. |
| SQL Injection Risk | CRITICAL | search.controller.js | LIKE queries susceptible to injection (though using parameters). |
| File Upload Unprotected | CRITICAL | logistics.controller.js | Evidence files (payment screenshots) can be uploaded without validation. |
| Export Files Path Traversal | HIGH | report.controller.js | Excel export path not validated - could be exploited. |
| Missing Rate Limiting | HIGH | All routes | No rate limiting on login, API endpoints vulnerable to brute force/DDoS. |
| JWT Secret Hardcoded | HIGH | Multiple controllers | Fallback to 'secret' if env variable missing - hardcoded default. |
| No API Logging | HIGH | app.js | No request/response logging for audit trail. |

### 8.2 FUNCTIONAL ISSUES

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Lead Duplicate Check | MEDIUM | lead.controller.js | Only checks existing phone on create, not on update. Duplicate can be created via update. |
| Auto-Assignment Logic | MEDIUM | lead.controller.js | Round-robin uses `updated_at` field which may not reflect actual assignment time if user doesn't log in often. |
| No Inventory Reservation | MEDIUM | order.controller.js | Order creation doesn't reserve inventory - double booking possible. |
| Status Transition Rules | MEDIUM | order.controller.js | No validation on status transitions (e.g., can't skip packed, go directly to delivered). |
| Deleted Order Orphans | MEDIUM | database | If order deleted, invoice/packing/shipment records remain orphaned. |
| Lead Transfer History | LOW | lead.controller.js | No audit trail of lead transfers between staff. |
| Follwp Date Validation | MEDIUM | lead.controller.js | Followup dates can be set to past dates - should be future only. |
| Multi-Language Support | LOW | Multiple paths | Language field exists but no translation system implemented - field stored but not used. |

### 8.3 DATABASE ISSUES

| Issue | Severity | Description |
|-------|----------|-------------|
| Missing Indexes | MEDIUM | No indexes on frequently queried columns (phone_number, status, assigned_to). Query performance degrades with large datasets. |
| No Audit Table | MEDIUM | No user_audit table to track who changed what and when. |
| Soft Delete Missing | MEDIUM | Hard deletes make data recovery impossible. No deleted_at column for soft deletes. |
| No Backup Strategy | HIGH | No backup/restore procedure documented in SQL files. |
| Connection Limit | MEDIUM | Pool limited to 10 connections - might bottleneck under load. |

### 8.4 FRONTEND ISSUES

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| CORS Hardcoded | MEDIUM | config.js | BASE_URL hardcoded to localhost:5000 - must manually change for production. |
| ROOT_PATH Logic | LOW | config.js | ROOT_PATH computation complex - could fail with unexpected URL structures. |
| Token Expiry Handling | MEDIUM | Multiple pages | No proactive token refresh - user must wait for 401 error to see login page. |
| No Error Boundaries | MEDIUM | All modules | Failed fetch calls can crash module without user feedback. |
| Manual Lead Form | LOW | manual-lead-form.html | Form validation minimal - required fields not checked client-side. |
| Sidebar Lazy Loading | LOW | components.js | Sidebar fetched dynamically - can cause brief flicker on page load. |

### 8.5 API ENDPOINT ISSUES

| Issue | Severity | API | Description |
|-------|----------|-----|-------------|
| GET /api/leads/stats | MEDIUM | lead.routes.js | Route defined but no controller method implementation. |
| GET /api/users/roles | MEDIUM | user.routes.js | Route defined but not implemented. |
| No Lead Search | MEDIUM | N/A | No dedicated lead search - global search exists but no lead-specific search. |
| Paging Missing | HIGH | All GET routes | No pagination (limit/offset) on list endpoints - returns all records causing performance issues. |
| Sorting Not Supported | MEDIUM | All GET routes | No sorting (order by fields) - always default sort. |
| No Batch Operations | MEDIUM | All routes | Can't bulk update/delete - only individual operations. |
| No Versioning | MEDIUM | All routes | No API version in routes - breaking changes would affect all clients. |

### 8.6 MIDDLEWARE & AUTH ISSUES

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| No Permission Cache | MEDIUM | auth.middleware.js | Role fetched from DB on every request if legacy token - DB overhead. |
| Token in Query String | HIGH | All routes | Tokens in Authorization header (correct) but should add HTTPS requirement. |
| No Logout Endpoint | MEDIUM | auth.routes.js | Token not invalidated server-side on logout - can't revoke tokens. |
| Session Fixation | MEDIUM | script.js | Token stored in localStorage - vulnerable to XSS attacks. |
| No CSRF Protection | HIGH | All routes | No CSRF tokens - forms could be forged from malicious sites. |

### 8.7 BUSINESS LOGIC ISSUES

| Issue | Severity | Description |
|-------|----------|-------------|
| Order without Inventory Check | HIGH | Can create order for products with zero stock. |
| Invoice Creation Missing | HIGH | Order → Billed status doesn't create invoice - manual step needed. |
| Lead Conversion Incomplete | MEDIUM | Converting lead to order doesn't trigger order creation in billing system. |
| Advance Payment Verification | MEDIUM | No automatic verification workflow - all payments manual verify. |
| GST Tax Calculation | MEDIUM | CGST/SGST/IGST stored but not automatically calculated - manual entry. |
| Role Permissions Too Broad | MEDIUM | Sales role has isAdminOrSales permission on many operations - can edit order status which should be admin/billing only. |
| No Refund Process | LOW | No refund or credit memo functionality. |
| No Return Management | LOW | Products once sold can't be returned/credited. |

---

## 9. MISSING FEATURES & ENHANCEMENTS

| Feature | Priority | Module | Description |
|---------|----------|--------|-------------|
| 2FA/MFA | HIGH | Auth | Two-factor authentication for security |
| WhatsApp API Integration | HIGH | Lead | Direct WhatsApp message sync (currently manual) |
| Email Notifications | HIGH | All | Email alerts for followups, status changes |
| SMS Notifications | MEDIUM | Lead | SMS to customers for order status |
| Google Calendar Sync | MEDIUM | Schedule | Sync followups to calendar |
| Customer Portal | MEDIUM | Frontend | Customers track orders online |
| Mobile App | MEDIUM | Frontend | React Native mobile version |
| Analytics Charts | MEDIUM | Reports | Line charts, pie charts for trends |
| Lead Scoring | MEDIUM | Lead | Automatic scoring based on engagement |
| Campaign Management | LOW | Marketing | Create campaigns, track ROI |
| Chat Support | LOW | Dashboard | Live chat widget support |
| Notification Center | MEDIUM | Dashboard | In-app notification center |
| Dark Mode | LOW | Frontend | Dark theme toggle |

---

## 10. TECHNOLOGY STACK

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 4.19.2
- **Database:** MySQL 8.0
- **Database Driver:** mysql2/promise 3.9.7
- **Authentication:** jsonwebtoken 9.0.2
- **Password Hashing:** bcryptjs 2.4.3
- **File Upload:** multer 1.4.5-lts.1
- **Excel Generation:** ExcelJS 4.4.0
- **CORS:** cors 2.8.5
- **Environment:** dotenv 16.4.5
- **Dev:** nodemon 3.1.0

### Frontend
- **Language:** Vanilla JavaScript (ES6+)
- **Markup:** HTML5
- **Styling:** CSS3 (Responsive)
- **Icons:** FontAwesome 6.5.1
- **Fonts:** Google Fonts (Inter)

### Infrastructure
- **Port:** 5000 (backend), 3000 (dev frontend)
- **File Storage:** /uploads directory
- **Database Pool:** 10 concurrent connections
- **Session:** JWT (8-hour expiration)
- **CORS:** Enabled for cross-origin requests

---

## 11. DEPLOYMENT & EXECUTION

### Installation Steps
```bash
1. cd backend
2. npm install
3. Configure .env file with DB credentials
4. mysql -u root -p < init_db.sql          # Create database
5. node seed_executor.js                   # Seed roles and users
6. npm start                                # Start backend (port 5000)
7. Access frontend at http://localhost:5000
```

### Environment Variables Required
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=admin_db
DB_PORT=3306
JWT_SECRET=your-secret-key (default: 'secret')
PORT=5000
```

### Default Roles to Create
```
- admin
- sales
- billing
- packing
- shipping
```

---

## 12. SUMMARY

**Project Status:** Functional MVP with Security & Scalability Issues
- Core CRM functionality fully implemented
- Multi-role access control working
- Database intact with proper relationships
- Basic reporting and export features
- Production-ready structure but needs security hardening

**Recommended Immediate Actions:**
1. Add input validation on all API endpoints
2. Implement pagination on list endpoints
3. Add rate limiting to prevent abuse
4. Implement proper error logging
5. Add database transaction support in all multi-step operations
6. Update frontend token handling for XSS protection
7. Create API rate limiting middleware
8. Add comprehensive API documentation
9. Implement database backup procedures
10. Set up monitoring and alerting

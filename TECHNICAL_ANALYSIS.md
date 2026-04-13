# SGB Agro CRM - Complete Technical Analysis

**Project Type:** Node.js/Express Backend + Vanilla JavaScript/HTML Frontend  
**Database:** MySQL  
**Architecture:** Modular MVC with Role-Based Access Control  
**Date:** April 11, 2026

---

## TABLE OF CONTENTS
1. [Backend Architecture](#backend-architecture)
2. [Routes & Endpoints](#routes--endpoints)
3. [Controllers & Methods](#controllers--methods)
4. [Middleware & Security](#middleware--security)
5. [Database Schema](#database-schema)
6. [Authentication System](#authentication-system)
7. [Frontend Architecture](#frontend-architecture)
8. [Frontend Modules Overview](#frontend-modules-overview)
9. [Data Flow & Integration](#data-flow--integration)
10. [Key Features](#key-features)

---

## BACKEND ARCHITECTURE

### Entry Points
- **server.js**: Express server initialization (Port: 5000)
- **src/app.js**: Express app configuration with middleware setup
- **src/config/db.js**: MySQL connection pool (mysql2/promise)

### Technology Stack
```json
{
  "runtime": "Node.js",
  "framework": "Express.js 4.19.2",
  "database": "MySQL (mysql2 3.9.7)",
  "auth": "JWT (jsonwebtoken 9.0.2)",
  "security": "bcryptjs 2.4.3",
  "export": "ExcelJS 4.4.0",
  "fileUpload": "multer 1.4.5-lts.1",
  "cors": "enabled",
  "bodyParser": "50MB limit"
}
```

### Middleware Stack (app.js)
- CORS enabled
- JSON parser (50MB limit)
- URL-encoded parser (50MB limit)
- Static file serving for `/uploads`
- Frontend static file serving (SPA support)

---

## ROUTES & ENDPOINTS

### 1. Authentication Routes (`/api/auth`)
**File:** `backend/src/routes/auth.routes.js`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | ❌ | User login, returns JWT token |
| GET | `/users` | ✅ | Get all active users |

**Request/Response:**
```
POST /login
Body: { email, password }
Response: { token, user: { id, name, role, language } }

GET /users (requires Bearer token)
Response: [{ id, name, email, phone, role }]
```

---

### 2. Lead Management Routes (`/api/leads`)
**File:** `backend/src/routes/lead.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | All | Get leads (filtered by role) |
| GET | `/stats` | ✅ | All | Get lead statistics |
| GET | `/:id` | ✅ | All | Get single lead |
| POST | `/` | ✅ | Sales/Admin | Create new lead |
| PUT | `/:id` | ✅ | Sales/Admin | Update lead details |
| PATCH | `/:id/assign` | ✅ | Sales/Admin | Assign lead to staff |
| POST | `/:id/transfer` | ✅ | Sales/Admin | Transfer lead to different language staff |
| DELETE | `/:id` | ✅ | Sales/Admin | Delete lead |
| GET | `/:id/notes` | ✅ | All | Get lead notes |
| POST | `/:id/notes` | ✅ | All | Add note to lead |

**Lead Status Values:** `new`, `assigned`, `contacted`, `followup`, `interested`, `not_interested`, `converted`, `lost`

---

### 3. Product Management Routes (`/api/products`)
**File:** `backend/src/routes/product.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | All | Get all products |
| POST | `/` | ✅ | Admin | Create product |
| PUT | `/:id` | ✅ | Admin | Update product |
| DELETE | `/:id` | ✅ | Admin | Delete product |

---

### 4. Dealer Management Routes (`/api/dealers`)
**File:** `backend/src/routes/dealer.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | All | Get all dealers |
| POST | `/` | ✅ | Admin | Create dealer |
| PUT | `/:id` | ✅ | Admin | Update dealer |
| DELETE | `/:id` | ✅ | Admin | Delete dealer |

---

### 5. Order Management Routes (`/api/orders`)
**File:** `backend/src/routes/order.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | All | Get orders with items |
| POST | `/convert` | ✅ | Sales/Admin | Convert lead to order |
| POST | `/dealer` | ✅ | Sales/Admin | Create dealer order |
| PATCH | `/:id/status` | ✅ | All | Update order status |

**Order Status:** `draft`, `billed`, `packed`, `shipped`, `delivered`, `cancelled`

---

### 6. Logistics Routes (`/api/logistics`)
**File:** `backend/src/routes/logistics.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/packing` | ✅ | All | Mark order as packed |
| POST | `/shipping` | ✅ | All | Record shipment |

---

### 7. Reporting Routes (`/api/reports`)
**File:** `backend/src/routes/report.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/dashboard-stats` | ✅ | All | Get dashboard KPIs (context-aware) |
| GET | `/leads` | ✅ | All | Export leads to Excel |
| GET | `/orders` | ✅ | All | Export orders to Excel |

**Dashboard Stats include:**
- `leadsToday`, `leadsMTD`
- `revenueMTD` (verified advance payments)
- `conversionRate` (%)
- `urgentAlerts`, `todayAlerts`
- Lead pipeline funnel
- Urgent tasks list

---

### 8. Global Search Route (`/api/search`)
**File:** `backend/src/routes/search.routes.js`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/?q=query` | ✅ | Search across leads, products, users (min 2 chars) |

**Returns:** 
```json
{
  "leads": [{ id, name, phone_number, status }],
  "products": [{ id, name, selling_price }],
  "users": [{ id, username }]
}
```

---

### 9. User Management Routes (`/api/users`)
**File:** `backend/src/routes/user.routes.js`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | Admin | Get all users (with stats) |
| GET | `/roles` | ✅ | Admin | Get all roles |
| POST | `/` | ✅ | Admin | Create new user |
| PUT | `/:id` | ✅ | Admin | Update user |
| PATCH | `/:id/password` | ✅ | Admin | Reset password |
| DELETE | `/:id` | ✅ | Admin | Delete user |

---

## CONTROLLERS & METHODS

### AuthController (`src/controllers/auth.controller.js`)

**login()**
- Validates email & password against database
- Checks account status (`active`/`inactive`)
- Uses bcryptjs for password comparison
- Issues JWT token with 8h expiration
- Returns user object with role

**getUsers()**
- Returns list of all active users
- Includes user ID, name, email, phone, role
- Used for staff selection dropdowns

---

### LeadController (`src/controllers/lead.controller.js`)

**Key Features:**
- **Role-Based Isolation:** Sales staff see only their assigned leads
- **Language-Based Auto-Assignment:** New leads auto-assigned to sales staff matching lead language (round-robin)
- **Lead Transfer:** Transfer leads between staff based on language requirement

**getLeads()**
- Filters by role (Sales sees only assigned leads)
- Optional filters: status, language, assigned_to
- Joins with user table for staff names

**createLead()**
- Duplicate prevention: Checks phone number uniqueness
- Language-based auto-assignment using round-robin
- Transaction-based: Updates user timestamp for queue rotation
- Logs creation with source (WhatsApp, manual, etc.)
- **Returns:** lead_id, assignedTo, status

**updateLead()**
- Updates all lead fields
- Logs status changes in lead_notes

**assignLead()**
- Assigns or reassigns lead to staff member
- Updates status to "assigned"

**transferLead()**
- Finds sales staff by target language (oldest updated first)
- Transfers lead to matched staff
- Updates language field
- Logs transfer reason

**getLeadById()**
- Retrieves specific lead
- Security check: Sales staff can't view leads not assigned to them

**deleteLeads()**
- Hard delete (cascades to related records)

**getLeadNotes() / addLeadNote()**
- Retrieves all notes for a lead with user who created them
- Adds timestamped notes

**getStats()**
- Role-aware: Admin sees all, Sales sees own assigned leads
- Counts by status
- Returns KPIs: total, today, unassigned, followup, interested, converted

---

### ProductController (`src/controllers/product.controller.js`)

**getProducts()**
- Retrieves all products ordered by creation date

**createProduct()**
- Creates product with SKU, pricing (selling_price, dealer_price)
- Sets minimum stock alert

**updateProduct()**
- Updates product attributes

**deleteProduct()**
- Deletes product

---

### DealerController (`src/controllers/dealer.controller.js`)

**getDealers()**
- Lists all dealers

**createDealer()**
- Stores dealer contact info, address, location

**updateDealer() / deleteDealer()**
- CRUD operations

---

### OrderController (`src/controllers/order.controller.js`)

**getOrders()**
- Retrieves orders with joined items and product names
- Restructures flat query results into nested items array
- Optional status filter

**convertLeadToOrder()**
- **Transaction-based**
- Validates required fields (lead_id, items array)
- Creates order record with `order_source = 'lead'`
- Inserts order items with quantity & price calculations
- Calculates total_amount and balance_amount
- Updates lead status to 'converted'
- Logs conversion in lead_notes
- **Returns:** orderId, conversion success

**createDealerOrder()**
- Similar to convertLeadToOrder but for dealer purchases
- Fetches dealer details for auto-population
- `order_source = 'dealer'`

**updateStatus()**
- Validates status against allowed values
- Updates order status

---

### LogisticsController (`src/controllers/logistics.controller.js`)

**packOrder()**
- Inserts packing record with packer ID and timestamp
- Updates order status to "packed"
- Records remarks

**shipOrder()**
- Inserts shipment record with courier info
- Generates tracking capability
- Updates order status to "shipped"

---

### ReportController (`src/controllers/report.controller.js`)

**getDashboardStats()**
- **Context-Aware:** Returns different data based on user role
- **Admin view:** All leads/orders
- **Sales view:** Only assigned leads

**KPI Calculations:**
```
leadsToday      = COUNT(leads WHERE DATE(created_at) = TODAY)
leadsMTD        = COUNT(leads WHERE MONTH = CURRENT_MONTH)
revenueMTD      = SUM(lead_advance_payments.amount WHERE verified='yes')
conversionRate  = (converted_leads / total_assigned_leads) × 100
urgentAlerts    = COUNT(overdue followups)
todayAlerts     = COUNT(followups due today)
```

**Funnel Data:** Lead counts by status (new, contacted, interested, converted, lost)

**Urgent Tasks:** Top 5 overdue follow-ups with customer name, due date, remarks

**exportLeads()**
- Generates Excel workbook with lead data
- Styled headers, columns for ID, name, phone, language, city, status, source, date

**exportOrders()**
- Similar Excel export for orders
- Includes: Order ID, customer, phone, status, total, advance, date

---

### SearchController (`src/controllers/search.controller.js`)

**globalSearch()**
- Minimum query length: 2 characters
- Searches 3 entities in parallel:
  - **Leads:** By customer_name OR phone_number (LIMIT 5)
  - **Products:** By name OR SKU (LIMIT 5)
  - **Users:** By name (LIMIT 5)
- Uses LIKE wildcards and case-insensitive matching

---

### UserController (`src/controllers/user.controller.js`)

**getAllUsers()**
- Joins with roles table
- Includes performance metrics:
  - `leads_handled`: Count of assigned leads
  - `conversions`: Count of converted leads
- Returns: user_id, name, email, phone, language, status, created_at, role_name, leads_handled, conversions

**getRoles()**
- Returns all available roles

**createUser()**
- Hashes password with bcryptjs (salt rounds: 10)
- Stores user with role_id and language preference
- Default language: 'EN'

**updateUser()**
- Updates name, email, phone, role, language, status

**resetPassword()**
- Hashes new password
- Admin-only operation

**deleteUser()**
- Hard delete

---

## MIDDLEWARE & SECURITY

### Authentication Middleware (`src/middleware/auth.middleware.js`)

**authenticateToken()**
- Expects: `Authorization: Bearer <token>` header
- Verifies JWT signature using JWT_SECRET from .env
- Token payload: `{ id, name, role }`
- **Backward Compatibility:** If old token lacks role, fetches from DB
- Returns 401 if no token, 403 if invalid token
- Attaches `req.user` to request

**isAdmin()**
- Checks if `req.user.role` is 'admin' or 'super-admin' (case-insensitive)
- Returns 403 if not admin

**isAdminOrSales()**
- Allows 'admin', 'super-admin', or 'sales' roles
- Used for lead and order operations

### Security Features
- ✅ Role-based access control (RBAC)
- ✅ Password hashing (bcryptjs)
- ✅ JWT token validation
- ✅ Data isolation by role
- ✅ Transaction support for multi-step operations
- ✅ Input validation on critical endpoints
- ❌ No rate limiting (potential enhancement)
- ❌ No input sanitization (SQL injection risk via LIKE in search)

---

## DATABASE SCHEMA

### Core Tables Structure

```
USERS & ROLES
├── roles (role_id, name, description, created_at)
└── users (user_id, name, phone, email, password_hash, role_id, 
           language, status, created_at, updated_at)
           │ [role_based_access]
           
LEADS (WhatsApp/Customer Acquisition Core)
├── leads (lead_id, phone_number[UNIQUE], first_message, language, 
           customer_name, address, city, state, status[ENUM],
           assigned_to[FK:users], source, created_at, updated_at)
├── lead_messages (message_id, lead_id[FK], message_type[ENUM],
                   message_text, media_url, timestamp)
├── lead_notes (note_id, lead_id[FK], user_id[FK], note, created_at)
├── lead_followups (followup_id, lead_id[FK], followup_date, 
                    status[ENUM], remarks, created_by[FK:users])
├── lead_interest (interest_id, lead_id[FK], product_id[FK],
                   crop_type, quantity_required, budget, remarks)
└── lead_advance_payments (advance_id, lead_id[FK], amount, 
                           payment_mode, screenshot_url, payment_date,
                           verified[ENUM], verified_by[FK:users])

MASTER DATA
├── dealers (dealer_id, dealer_name, contact_person, phone, email,
             address, city, state, created_at)
└── products (product_id, name, category, description, sku[UNIQUE],
              unit, selling_price, dealer_price, min_stock_alert,
              created_at)

INVENTORY
├── inventory (inventory_id, product_id[UNIQUE][FK], current_stock,
               reserved_stock, last_updated)
└── inventory_logs (log_id, product_id[FK], type[ENUM], quantity,
                    reference_type, reference_id, created_at)

ORDERS (Unified: Lead Conversions + Dealer Orders)
├── orders (order_id, order_source[ENUM:'lead'/'dealer'],
            lead_id[FK], dealer_id[FK], customer_name, phone, address,
            city, state, order_status[ENUM], created_by[FK:users],
            billing_done_by[FK:users], total_amount, advance_amount,
            balance_amount, created_at, updated_at)
└── order_items (order_item_id, order_id[FK], product_id[FK],
                 quantity, price, total_price)

BILLING (GST Invoice System)
├── invoices (invoice_id, order_id[FK], invoice_number[UNIQUE],
              invoice_date, billing_name, billing_address, gst_number,
              subtotal, cgst, sgst, igst, total_amount,
              payment_status[ENUM], created_by[FK:users], created_at)
└── invoice_items (invoice_item_id, invoice_id[FK], product_id[FK],
                   quantity, price, gst_percentage, total)

LOGISTICS
├── packing (packing_id, order_id[FK], packed_by[FK:users],
             packed_at, status[ENUM], remarks)
└── shipments (shipment_id, order_id[FK], courier_name, tracking_id,
               shipped_by[FK:users], shipped_at, status[ENUM])

NOTIFICATIONS & CHAT
├── notifications (notification_id, order_id[FK], lead_id[FK],
                   type, message, recipient_phone, status[ENUM],
                   sent_at)
├── chat_sessions (session_id, lead_id[FK], assigned_to[FK:users],
                   status[ENUM], created_at)
└── chat_messages (chat_id, session_id[FK], sender_type[ENUM],
                   message, media_url, created_at)
```

### Key Relationships
- **leads.assigned_to** → users.user_id (Lead ownership)
- **orders.order_source** → determines lead_id vs dealer_id
- **lead_advance_payments.verified** → Revenue tracking
- **Foreign Key Constraints:** CASCADE/SET NULL on deletes

---

## AUTHENTICATION SYSTEM

### JWT Token Flow

1. **Login Request**
   ```
   POST /api/auth/login
   { email, password }
   ```

2. **Backend Processing**
   - Query user by email
   - Verify bcryptjs password hash
   - Check account status (must be 'active')
   - Generate JWT: `jwt.sign({ id, name, role }, JWT_SECRET, { expiresIn: '8h' })`

3. **Response**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "id": 1,
       "name": "John Sales",
       "role": "sales",
       "language": "EN"
     }
   }
   ```

4. **Frontend Storage**
   - Token → localStorage['token']
   - User → localStorage['user'] (JSON string)
   - Username → localStorage['username']

5. **Subsequent Requests**
   - Include `Authorization: Bearer <token>` header
   - Backend validates signature and expiration

### Token Validation
- **Invalid/Missing Token:** 401 Unauthorized
- **Expired Token:** 403 Forbidden (session expired)
- **Invalid Signature:** 403 Forbidden

### Role-Based Access
```javascript
Admin        → All data, all operations
Super-Admin  → Same as Admin
Sales        → Own assigned leads + lead operations
Billing      → Billing module access
Packing      → Packing module access
Shipping     → Shipping module access
```

---

## FRONTEND ARCHITECTURE

### Structure Overview
```
frontend/
├── index.html              # Login page (SPA entry)
├── css/styles.css          # Global Tailwind-based styling
├── js/
│   ├── config.js           # Global config, auth helpers, role redirects
│   ├── script.js           # Login form handler
│   ├── components.js       # Shared UI: sidebar, search, auth
│   ├── dashboard-logic.js  # (unused placeholder)
│   ├── dealers.js          # (unused placeholder)
│   ├── inventory.js        # (unused placeholder)
│   ├── packaging.js        # (unused placeholder)
│   ├── reports.js          # (unused placeholder)
│   ├── shipment.js         # (unused placeholder)
│   └── users.js            # (unused placeholder)
├── components/
│   ├── sidebar-admin.html
│   ├── sidebar-sales.html
│   ├── sidebar-billing.html
│   ├── sidebar-packing.html
│   ├── sidebar-shipping.html
│   ├── lead-nav.html
│   ├── lead-list.html
│   ├── lead-details.html
│   ├── followup-view.html
│   ├── manual-lead-form.html
│   └── schedule-view.html
└── modules/
    ├── admin/          # Administrator dashboard & controls
    ├── sales/          # Sales team interface
    ├── billing/        # Billing & invoicing
    ├── packing/        # Warehouse packing operations
    └── shipping/       # Shipping & logistics tracking
```

### Global Configuration (`js/config.js`)

**Key Variables:**

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | Backend URL (dynamic detection) |
| `ROOT_PATH` | Relative path depth calculator |
| `ROLE_REDIRECTS` | Role → Module mapping |
| `getCurrentUser()` | Retrieve user from localStorage or decode JWT |
| `requireAuth()` | Auth guard redirect |
| `doLogout()` | Clear session and redirect |

**Root Path Logic:**
- Detects page depth (index.html vs modules/admin/dashboard.html)
- Computes relative path count (`../`) automatically
- Enables dynamic component loading

---

## FRONTEND MODULES OVERVIEW

### 1. Admin Module (`modules/admin/`)

#### Pages
```
admin/
├── dashboard.html      → KPI cards, pipeline, urgent tasks, charts
├── users.html          → Staff member CRUD, roles management
├── inventory.html      → Product stock levels (placeholder)
├── orders.html         → Order pipeline, action buttons
├── dealers.html        → Dealer management (placeholder)
├── leads.html          → Lead list and details (placeholder)
├── pipeline.html       → Sales funnel visualization (placeholder)
├── reports.html        → Analytics and exports (placeholder)
├── schedule.html       → Calendar & follow-ups (placeholder)
├── settings.html       → System configuration (placeholder)
└── logs.html           → Audit logs (placeholder)
```

#### Key Functionality

**dashboard.js**
- Loads dashboard stats via `/api/reports/dashboard-stats`
- **KPI Display:** leadsToday, leadsMTD, conversionRate, urgentAlerts, revenueMTD
- **Pipeline Mini View:** Renders lead status distribution with colors
- **Urgent Panel:** Top 5 overdue followups
- **Chart:** Bar chart of lead stages
- **Authentication:** Requires admin role

**users.js**
- **CRUD Operations:**
  - Fetch users with roles and performance metrics
  - Multi-step modal for create/edit
  - Password reset (hash on backend)
  - Soft/hard delete
- **Features:**
  - Tab navigation: Users | Roles
  - Search filtering (real-time)
  - Role dropdown population
  - Performance badges (leads handled, conversion rate)
  - Status indicator (active/inactive)

**orders.js**
- Fetches orders with status grouping
- **Status Counts:** draft, packed, billed, shipped
- **Order Details:** Order ID, customer, items, total, status, date
- **Action Buttons:** Pack, Bill, Ship (navigation links)
- **Status Colors:** Coded UI feedback

---

### 2. Sales Module (`modules/sales/`)

#### Pages
```
sales/
├── dashboard.html      → My KPIs, pipeline, urgent tasks
├── leads.html          → Lead management (placeholder)
├── orders.html         → My orders (placeholder)
├── pipeline.html       → My pipeline (placeholder)
├── dealers.html        → Dealer contacts (placeholder)
├── activity.html       → Activity log (placeholder)
├── reports.html        → My reports (placeholder)
└── schedule.html       → My follow-ups (placeholder)
```

#### Key Functionality

**dashboard.js**
- **Sales-Specific KPIs:**
  - leadsToday (created today)
  - leadsMTD (month-to-date)
  - urgentAlerts (overdue follow-ups)
  - conversionRate (%)
  - revenueMTD (verified advance payments)
- **Funnel Visualization:** Lead stages with actual counts
- **Urgent Panel:** Overdue follow-ups with call-now buttons
- **Chart:** Dual-line chart (leads vs conversions trends)
- **Authentication:** Requires sales or admin role

---

### 3. Billing Module (`modules/billing/`)

#### Pages
```
billing/
├── billing.html        → Order billing interface
└── invoice.html        → Invoice template (placeholder)
```

#### Key Functionality

**billing.js**
- Fetches packed orders ready for billing
- **Order Display:**
  - Order ID, customer name, items, total, advance, balance due
  - Editable search/filter
- **Invoice Generation:**
  - Button triggers status update to 'billed'
  - Order state transitions: draft → packed → billed
  - Toast notifications on success/error

---

### 4. Packing Module (`modules/packing/`)

#### Pages
```
packing/
└── packing.html        → Warehouse packing operations
```

#### Key Functionality

**packing.js**
- Fetches orders in 'draft' status (ready to pack)
- **Warehouse Operations:**
  - Display: Order ID, customer, phone, items, created date
  - Items shown as product badges with quantities
  - Mark Packed button → `/api/logistics/packing` POST
- **Status Transition:** draft → packed
- **Toast Feedback:** Success/error messages

---

### 5. Shipping Module (`modules/shipping/`)

#### Pages
```
shipping/
└── shipping.html       → Shipping & tracking
```

#### Key Functionality

**shipping.js**
- Fetches packed orders ready to ship
- **Shipping Form Modal:**
  - Courier name dropdown/input
  - Tracking number field
- **POST to `/api/logistics/shipping`:**
  - Parameters: order_id, courier_name, tracking_id
- **Status Transition:** packed → shipped
- **Data Validation:** Required fields enforcement

---

## SHARED FUNCTIONALITY

### Sidebar Component (`js/components.js`)

**Features:**
- Dynamic sidebar injection (role-based template)
- Active link highlighting
- Logout button binding
- Component loader helper function
- Lead navigation tabs (All, Unassigned, Today's, Follow-ups, Manual)
- Lead statistics badge updater

**Component Loading:**
- Fetches HTML from `components/` folder
- Injects into DOM
- Triggers initialization callbacks
- Handles loading errors

**Lead Nav Tabs:**
```
All Leads       → Load lead-list.html
Unassigned      → Filter for unassigned leads
Today's Leads   → Filter for today's creation date
Call Schedule   → Load schedule-view.html
Follow-ups      → Load followup-view.html
Manual Entry    → Load manual-lead-form.html
```

### Global Search (`components.js`)

**Features:**
- Real-time search box in sidebars
- Minimum query length: 2 characters
- Parallel search across 3 entities
- Results dropdown display
- Click-to-navigate to lead/product details

---

## DATA FLOW & INTEGRATION

### End-to-End: Lead Creation to Order Conversion

```mermaid
1. LEAD CREATION (Sales Dashboard)
   ↓
   POST /api/leads { phone_number, customer_name, first_message, language }
   ↓
   Backend Processing:
   a) Check for duplicate phone
   b) Auto-assign based on language + round-robin
   c) Create lead record (status: 'assigned' or 'new')
   d) Log creation in lead_notes
   ↓
   Response: { lead_id, assignedTo, status }
   ↓
   Frontend: Lead appears in sidebar badge
   ↓

2. LEAD MANAGEMENT (Sales Dashboard)
   ├─ GET /api/leads → Display lead list
   ├─ GET /api/leads/:id → Show details
   ├─ PUT /api/leads/:id → Update status/info
   ├─ GET /api/leads/:id/notes → Show notes
   └─ POST /api/leads/:id/notes → Add note
   ↓

3. LEAD CONVERSION TO ORDER (Sales → Order Module)
   ↓
   POST /api/orders/convert {
     lead_id,
     customer_name,
     phone,
     address,
     city,
     state,
     advance_amount,
     items: [{ product_id, quantity, price }]
   }
   ↓
   Backend Transaction:
   a) Create order (order_source: 'lead')
   b) Create order_items
   c) Calculate totals
   d) Update lead.status = 'converted'
   e) Log in lead_notes
   ↓
   Response: { orderId, leadStatus: 'converted' }
   ↓

4. ORDER WORKFLOW
   ├─ PACKING (draft → packed)
   │  POST /api/logistics/packing { order_id, remarks }
   │
   ├─ BILLING (packed → billed)
   │  PATCH /api/orders/:id/status { status: 'billed' }
   │
   └─ SHIPPING (billed/packed → shipped)
      POST /api/logistics/shipping { order_id, courier_name, tracking_id }
```

### Frontend-Backend Communication

**Authentication Flow:**
```
1. index.html (login form)
   ↓
2. POST /api/auth/login
   ↓
3. Response with JWT + user object
   ↓
4. Store in localStorage
   ↓
5. Redirect to role-based module
   ↓
6. All subsequent requests include: Authorization: Bearer <token>
```

**Data Fetching Pattern:**
```
1. Component loaded (dashboard.html)
2. requireAuth() checks token
3. getCurrentUser() retrieves user object
4. fetch('/api/<endpoint>', { headers: { 'Authorization': 'Bearer <token>' } })
5. Response parsed
6. DOM updated with data
```

---

## KEY FEATURES

### ✅ Implemented Features

**Lead Management:**
- ✅ Lead creation with auto-assignment
- ✅ Language-based round-robin assignment
- ✅ Lead transfer between staff
- ✅ Lead status tracking (new → assigned → contacted → interested → converted)
- ✅ Lead notes and follow-ups
- ✅ Advance payment tracking
- ✅ Duplicate detection

**Order Management:**
- ✅ Lead-to-order conversion
- ✅ Dealer order creation
- ✅ Order item management
- ✅ Order status pipeline (draft → packed → billed → shipped)
- ✅ Amount tracking (total, advance, balance)

**Logistics:**
- ✅ Packing workflow
- ✅ Shipment tracking (courier + tracking ID)
- ✅ Order status transitions

**Reporting:**
- ✅ Dashboard KPIs (role-aware)
- ✅ Lead pipeline visualization
- ✅ Excel export (leads & orders)
- ✅ Performance metrics (leads handled, conversions)

**Administration:**
- ✅ User management (CRUD)
- ✅ Role-based access control
- ✅ Password hashing
- ✅ User status management (active/inactive)
- ✅ Multi-language support (UI level)

**Security:**
- ✅ JWT authentication
- ✅ Role-based authorization
- ✅ Data isolation by role
- ✅ Transaction support for multi-step operations
- ✅ Bcryptjs password hashing

### ⚠️ Partially Implemented

- 🟡 Global search (no pagination)
- 🟡 Inventory management (DB structure exists, no UI)
- 🟡 GST invoice generation (DB structure exists, API stubbed)
- 🟡 Chat/notifications (DB tables exist, no API endpoints)
- 🟡 Dealer orders (API exists, limited UI)

### ❌ Not Implemented

- ❌ File uploads (multer configured but no endpoints)
- ❌ WhatsApp integration
- ❌ Rate limiting
- ❌ Request validation middleware
- ❌ SQL injection protection (parameterized queries used but no ORM)
- ❌ Request logging/audit trails (DB structure exists)
- ❌ Email notifications

---

## PERFORMANCE & SCALABILITY

### Current Approach
- MySQL connection pool (max 10 connections)
- No caching layer (Redis)
- No pagination on GET endpoints
- Full data loads on module initialization

### Bottlenecks Identified
1. **Dashboard Stats:** Complex multi-query aggregation (7+ queries)
2. **Orders with Items:** Left joins + client-side restructuring
3. **Search:** LIKE queries on large datasets
4. **Lead Lists:** Potential N+1 queries if not optimized

### Optimization Opportunities
- Add indexes on frequently queried fields (phone_number, status, assigned_to)
- Implement pagination for large datasets
- Cache dashboard stats (5-min TTL)
- Use aggregate queries for statistics
- Denormalize frequently accessed relations

---

## PROJECT ENTRY POINTS

**Backend:** `node server.js` (Port 5000)
**Frontend:** Access via `http://localhost:5000/index.html`
**Database:** MySQL connection via `.env` configuration

---

## ENVIRONMENT VARIABLES REQUIRED

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=admin_db
DB_PORT=3306
JWT_SECRET=your_secret_key
PORT=5000
```

---

## DEPLOYMENT CHECKLIST

- [ ] Verify .env file configuration
- [ ] Run `init_db.sql` to setup database
- [ ] Run `seed_roles.sql` to populate roles
- [ ] Run `seed_demo_data.sql` for test data
- [ ] Install npm dependencies: `npm install`
- [ ] Start backend: `npm start` or `npm run dev`
- [ ] Access frontend at configured URL
- [ ] Test login with demo credentials from seed data
- [ ] Verify role-based routing
- [ ] Test lead creation and conversion workflow


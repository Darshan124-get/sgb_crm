# SGB AGRO CRM - SYSTEM ARCHITECTURE & DATA FLOW

---

## SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (FRONTEND)                         │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Browser (Vanilla JS + HTML5 + CSS3)                            │  │
│  │                                                                  │  │
│  │  ├─ index.html (Login Page)                                     │  │
│  │  ├─ modules/admin/dashboard.html (Admin Dashboard)            │  │
│  │  ├─ modules/sales/dashboard.html (Sales Dashboard)            │  │
│  │  ├─ modules/billing/billing.html (Billing)                    │  │
│  │  ├─ modules/packing/packing.html (Packing)                    │  │
│  │  └─ modules/shipping/shipping.html (Shipping)                 │  │
│  │                                                                  │  │
│  │  JS Files:                                                       │  │
│  │  ├─ js/config.js (BASE_URL, Role Redirects)                  │  │
│  │  ├─ js/script.js (Login Handler, Auth)                        │  │
│  │  ├─ js/components.js (Sidebar, Global Search)                │  │
│  │  └─ js/dashboard-logic.js (KPI Charts, Stats)                │  │
│  │                                                                  │  │
│  │  Components:                                                     │  │
│  │  ├─ components/sidebar-*.html (Role-based menus)              │  │
│  │  ├─ components/lead-*.html (Lead forms & details)             │  │
│  │  └─ components/schedule-view.html (Calendar)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                               ↓ HTTPS/JSON                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    API LAYER (BACKEND - Express.js)                     │
│                           Port: 5000                                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ src/app.js - Express Application Setup                         │  │
│  │                                                                  │  │
│  │  Middleware Stack:                                              │  │
│  │  1. cors()                    - Enable cross-origin requests   │  │
│  │  2. express.json()            - Parse JSON body (50MB limit)   │  │
│  │  3. express.urlencoded()      - Parse URL-encoded body        │  │
│  │  4. express.static()          - Serve static frontend files   │  │
│  │  5. authenticateToken         - JWT verification (custom)     │  │
│  │  6. isAdmin / isAdminOrSales  - Role-based authorization      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ Routes Layer ─────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │  /api/auth          → auth.controller.js (Login, Verify)      │   │
│  │  /api/leads         → lead.controller.js (CRUD, Assignment)   │   │
│  │  /api/products      → product.controller.js (Inventory)       │   │
│  │  /api/dealers       → dealer.controller.js (Retailers)        │   │
│  │  /api/orders        → order.controller.js (Sales Orders)      │   │
│  │  /api/logistics     → logistics.controller.js (Pack/Ship)     │   │
│  │  /api/reports       → report.controller.js (Dashboard, Export)│   │
│  │  /api/search        → search.controller.js (Global Search)    │   │
│  │  /api/users         → user.controller.js (Staff Management)   │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Auth Middleware ──────────────────────────────────────────────┐   │
│  │ authenticateToken()  - Verify JWT signature & expiration      │   │
│  │ isAdmin()           - Check admin role                        │   │
│  │ isAdminOrSales()    - Check admin or sales role              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               ↓ MySQL Queries
┌─────────────────────────────────────────────────────────────────────────┐
│                  DATA LAYER (MySQL - 18 Tables)                         │
│                                                                         │
│  ┌─ Users & Auth ─────────────────────────────────────────────────┐   │
│  │ • roles (5 records)     - Admin, Sales, Billing, Packing, Ship│   │
│  │ • users (50-500)        - Staff members with roles            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Leads (WhatsApp Integration) ───────────────────────────────┐    │
│  │ • leads (1000-10000)           - Customer prospects           │    │
│  │ • lead_messages (5000+)        - WhatsApp message history    │    │
│  │ • lead_notes (2000+)           - Internal notes              │    │
│  │ • lead_followups (3000+)       - Scheduled callbacks         │    │
│  │ • lead_interest (1000+)        - Product interests captured  │    │
│  │ • lead_advance_payments (500+) - Partial payments received   │    │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Products & Inventory ─────────────────────────────────────────┐   │
│  │ • products (100-1000)       - Product catalog                 │   │
│  │ • inventory (100-1000)      - Stock levels per product        │   │
│  │ • inventory_logs (5000+)    - Stock movement audit trail      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Orders & Dealers ────────────────────────────────────────────┐    │
│  │ • orders (500-5000)          - Customer orders (Lead/Dealer)  │    │
│  │ • order_items (2000-20000)  - Line items in orders           │    │
│  │ • dealers (100-500)          - Wholesale/retail partners      │    │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Billing & Invoicing ──────────────────────────────────────────┐   │
│  │ • invoices (500-5000)        - GST-compliant bills            │   │
│  │ • invoice_items (2000-20000) - Line items per invoice        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Logistics (Packing & Shipping) ────────────────────────────────┐  │
│  │ • packing (500-5000)         - Warehouse packing records      │  │
│  │ • shipments (500-5000)       - Courier tracking               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Database: admin_db                                                    │
│  Encoding: UTF-8MB4 (Unicode support)                                 │
│  Connection Pool: 10 concurrent connections                           │
│  Query Type: Parameterized (protected from SQL injection)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## REQUEST/RESPONSE FLOW

### 1. USER LOGIN FLOW

```
┌─────────────┐
│   Browser   │
│  (index.html)
└──────┬──────┘
       │ 1. User enters email & password
       │
       ▼
   ┌────────────────────────────┐
   │  script.js                 │
   │  listeners.loginForm.submit│
   └─────────┬──────────────────┘
             │ 2. POST /api/auth/login (email, password)
             │
             ▼
   ┌──────────────────────────────┐
   │  Express: app.js             │
   │  routes/auth.routes.js       │
   └─────────┬────────────────────┘
             │ 3. Route to controller
             │
             ▼
   ┌──────────────────────────────┐
   │  auth.controller.login()     │
   │  • Query user by email       │
   │  • Hash password verification│
   │  • JWT token generation      │
   └─────────┬────────────────────┘
             │ 4. Response: {token, user}
             │
             ▼
   ┌──────────────────────────────┐
   │  script.js                   │
   │  • Store token in localStorage
   │  • Store user object         │
   │  • Role-based redirect       │
   └─────────┬────────────────────┘
             │ 5. Redirect to dashboard
             │    (modules/sales/dashboard.html OR etc)
             │
             ▼
   ┌─────────────────────────────┐
   │  Dashboard Page             │
   │  (JS loaded with token)     │
   └─────────────────────────────┘
```

### 2. LEAD CREATION FLOW

```
┌──────────────────────────┐
│  Sales Agent             │
│  modules/sales/leads.html│
└──────┬───────────────────┘
       │ 1. Click "Create Lead" button
       │
       ▼
   ┌─────────────────────────────────┐
   │ manual-lead-form.html           │
   │ (Component loaded dynamically) │
   └──────┬──────────────────────────┘
          │ 2. Fill form (phone, name, etc)
          │
          ▼
      ┌───────────────────────────────┐
      │ leads.js                       │
      │ form.addEventListener('submit'│)
      │ POST /api/leads with form data│
      └───┬───────────────────────────┘
          │ 3. API Call (Bearer token in header)
          │
          ▼
      ┌────────────────────────────┐
      │ auth.middleware.js         │
      │ authenticateToken()        │
      │ • Verify JWT signature     │
      │ • Extract user ID & role   │
      │ • Allow or reject request  │
      └────┬─────────────────────────┘
           │ 4. Check role permission
           │
           ▼
      ┌────────────────────────────┐
      │ auth.middleware.js         │
      │ isAdminOrSales()           │
      │ • User role = 'sales'? ✓   │
      └────┬─────────────────────────┘
           │ 5. Execute controller
           │
           ▼
      ┌─────────────────────────────────────┐
      │ lead.controller.createLead()        │
      │ 1. Check duplicate by phone_number  │
      │ 2. Find language-based sales staff  │
      │ 3. Round-robin assignment logic     │
      │ 4. INSERT into leads table          │
      │ 5. Commit transaction               │
      └────┬────────────────────────────────┘
           │ 6. Response: {message, lead_id}
           │
           ▼
      ┌────────────────────────────┐
      │ leads.js (Frontend)        │
      │ • Show success message     │
      │ • Refresh leads list       │
      │ • Display new lead ID      │
      └────────────────────────────┘
```

### 3. LEAD TO ORDER CONVERSION FLOW

```
┌──────────────────────────┐
│  Sales Agent             │
│  modules/sales/leads.html│
│  [Viewing interested lead]
└──────┬───────────────────┘
       │ 1. Click "Convert to Order"
       │
       ▼
   ┌──────────────────────────────────┐
   │  Manual Lead Form (Order Form)   │
   │  • Quantity selection            │
   │  • Pricing confirmation          │
   │  • Advance payment option        │
   └──────┬───────────────────────────┘
          │ 2. Submit conversion form
          │
          ▼
      ┌──────────────────────────────────┐
      │ order.js                         │
      │ POST /api/orders/convert         │
      │ Payload: {                       │
      │   lead_id,                       │
      │   items: [{ product_id, qty }],  │
      │   advance_amount                 │
      │ }                                │
      └───┬──────────────────────────────┘
          │ 3. API call
          │
          ▼
      ┌────────────────────────────────────┐
      │ order.controller.convertLeadToOrder│
      │ 1. START TRANSACTION               │
      │ 2. Create order record             │
      │ 3. Add order_items (line items)   │
      │ 4. Calculate order total           │
      │ 5. Update lead status→'converted' │
      │ 6. Add note to lead                │
      │ 7. COMMIT TRANSACTION              │
      │ (Or ROLLBACK on error)             │
      └────┬─────────────────────────────────┘
           │ 4. Response: {orderId, message}
           │
           ▼
      ┌─────────────────────────────┐
      │ order.js (Frontend)         │
      │ • Redirect to orders module │
      │ • Show order ID             │
      │ • Refresh order list        │
      └─────────────────────────────┘

Lead Status Progression:
new → assigned → contacted → interested → [CONVERT] → converted
                                                ↓
                                         [Order Created]
                                              ↓
                                         order_id linked
```

### 4. ORDER STATUS LIFECYCLE

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER STATUS PROGRESSION                     │
└─────────────────────────────────────────────────────────────────┘

    [CREATED]
        │
        ▼
    ┌─────────────────┐
    │ order_status    │
    │  = 'draft'      │
    │                 │
    │ Sales Team      │
    │ Reviews Order   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  PATCH /api/orders/:id      │
    │  {status: 'billed'}         │
    │                             │
    │  Billing Team               │
    │  • Generates invoice        │
    │  • Applies GST taxes        │
    │  • Sends to customer        │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  order_status               │
    │  = 'billed'                 │
    │                             │
    │  Awaiting payment           │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  POST /api/logistics/packing│
    │  {order_id, remarks}        │
    │                             │
    │  Packing Team               │
    │  • Pick items from warehouse│
    │  • Verify quantities        │
    │  • Pack in boxes            │
    │  • Create packing records   │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  order_status               │
    │  = 'packed'                 │
    │                             │
    │  Ready for dispatch         │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  POST /api/logistics/shipping
    │  {order_id, courier_name,   │
    │   tracking_id}              │
    │                             │
    │  Shipping Team              │
    │  • Arrange parcel pickup    │
    │  • Label with tracking ID   │
    │  • Hand to courier          │
    │  • Record shipment          │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  order_status               │
    │  = 'shipped'                │
    │                             │
    │  In Transit                 │
    │  (Update: PATCH with status)│
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  order_status               │
    │  = 'delivered'              │
    │                             │
    │  Customer Received          │
    │  (Order Complete)           │
    └─────────────────────────────┘
```

---

## DATA RELATIONSHIPS DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│                       CORE RELATIONSHIPS                          │
└──────────────────────────────────────────────────────────────────┘

           ┌─────────┐
           │  ROLES  │ (admin, sales, billing, packing, shipping)
           └────┬────┘
                │ role_id (FK)
                │
                ▼
          ┌──────────┐
          │  USERS   │ (Staff members)
          ├──────────┤
          │user_id   │
          │name      │
          │email     │
          │role_id→  │───→ ROLES
          │language  │
          │status    │
          └────┬─────┘
               │ assigned_to / created_by / packed_by / shipped_by
               │
        ┌──────┼──────┬──────────┬──────────┐
        │      │      │          │          │
        ▼      ▼      ▼          ▼          ▼
    ┌────────┐ ┌─────────────┐  ┌──────────┐  ┌──────────┐
    │ LEADS  │ │LEAD_NOTES   │  │ PACKING  │  │SHIPMENTS │
    ├────────┤ ├─────────────┤  └──────────┘  └──────────┘
    │lead_id │ │note_id      │
    │phone   │ │lead_id→LEADS│
    │status  │ │user_id→USER │
    │assigned│ │note (TEXT)  │
    │to→USER │ └─────────────┘
    └───┬────┘
        │ lead_id (FK)
        │
        ├──→ LEAD_MESSAGES
        │    ├─ message_id
        │    ├─ lead_id → LEADS
        │    ├─ message_type (incoming/outgoing)
        │    └─ message_text
        │
        ├──→ LEAD_FOLLOWUPS
        │    ├─ followup_id
        │    ├─ lead_id → LEADS
        │    ├─ followup_date
        │    ├─ status (pending/done)
        │    └─ created_by → USERS
        │
        ├──→ LEAD_INTEREST
        │    ├─ interest_id
        │    ├─ lead_id → LEADS
        │    ├─ product_id → PRODUCTS
        │    ├─ quantity_required
        │    └─ budget
        │
        ├──→ LEAD_ADVANCE_PAYMENTS
        │    ├─ advance_id
        │    ├─ lead_id → LEADS
        │    ├─ amount
        │    ├─ verified (yes/no)
        │    └─ verified_by → USERS
        │
        └──→ ORDERS
             ├─ order_id
             ├─ lead_id → LEADS
             ├─ order_source = 'lead'
             ├─ order_status
             └─ created_by → USERS


       ┌─────────────────────────────────────────────────┐
       │              ORDER RELATIONSHIPS                │
       └─────────────────────────────────────────────────┘

            ┌──────────┐
            │  DEALERS │
            ├──────────┤
            │dealer_id │
            │name      │
            │contact   │
            │phone     │
            └────┬─────┘
                 │ dealer_id (FK)
                 │
                 ▼
            ┌──────────┐
            │  ORDERS  │
            ├──────────┤
            │order_id  │
            │lead_id ──┼── LEADS (if source='lead')
            │dealer_id┼── DEALERS (if source='dealer')
            │status   │
            │total_amt│
            └─┬──┬──┬─┘
              │  │  └─→ INVOICES
              │  │      ├─ invoice_id
              │  │      ├─ order_id → ORDERS
              │  │      ├─ invoice_number
              │  │      ├─ gst_number
              │  │      ├─ cgst/sgst/igst
              │  │      ├─ payment_status
              │  │      └─ created_by → USERS
              │  │         │
              │  │         └─→ INVOICE_ITEMS
              │  │             ├─ invoice_item_id
              │  │             ├─ invoice_id → INVOICES
              │  │             ├─ product_id → PRODUCTS
              │  │             ├─ quantity
              │  │             └─ gst_percentage
              │  │
              │  └─→ ORDER_ITEMS
              │      ├─ order_item_id
              │      ├─ order_id → ORDERS
              │      ├─ product_id → PRODUCTS
              │      ├─ quantity
              │      └─ price
              │
              └─→ PACKING (optional)
              │  ├─ packing_id
              │  ├─ order_id → ORDERS
              │  ├─ packed_by → USERS
              │  └─ packed_at
              │
              └─→ SHIPMENTS
                 ├─ shipment_id
                 ├─ order_id → ORDERS
                 ├─ courier_name
                 ├─ tracking_id
                 └─ shipped_by → USERS


       ┌─────────────────────────────────────────────────┐
       │           INVENTORY RELATIONSHIPS               │
       └─────────────────────────────────────────────────┘

            ┌──────────┐
            │PRODUCTS  │
            ├──────────┤
            │product_id│
            │name      │
            │sku       │
            │category  │
            │price     │
            └────┬─────┘
                 │ product_id
                 │
         ┌───────┼───────┐
         │       │       │
         ▼       ▼       ▼
    ┌────────┐ ┌──────────┐ ┌───────────────┐
    │INVENTORY│ │LEAD_     │ │ORDER_ITEMS   │
    ├────────┤ │INTEREST  │ └───────────────┘
    │current │ ├──────────┤ (links products
    │_stock  │ │lead_id   │  to order lines)
    │reserved│ │product_id│
    │_stock  │ │quantity  │
    └───┬────┘ │required  │
        │      └──────────┘
        │
        └─→ INVENTORY_LOGS
            ├─ log_id
            ├─ product_id → PRODUCTS
            ├─ type (in/out/adjustment)
            ├─ quantity
            └─ reference_id (to order/manual)
```

---

## API AUTHENTICATION FLOW

```
┌──────────────────────────────────────────────────────────────┐
│             JWT TOKEN AUTHENTICATION FLOW                    │
└──────────────────────────────────────────────────────────────┘

1. LOGIN REQUEST
   ┌─────────────────────────────────────────┐
   │ POST /api/auth/login                    │
   │ {                                       │
   │   "email": "sales@sgbagro.com",         │
   │   "password": "password123"             │
   │ }                                       │
   └──────────────────┬──────────────────────┘
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │ auth.controller.login()                 │
   │ • Query user by email                   │
   │ • bcryptjs.compare(password, hash)      │
   │ • jwt.sign({id, name, role}, SECRET)   │
   └──────────────────┬──────────────────────┘
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │ RESPONSE                                │
   │ {                                       │
   │   "token": "eyJhbGciOiJIUzI1NiIs...",  │
   │   "user": {                             │
   │     "id": 5,                            │
   │     "name": "John Sales",               │
   │     "role": "sales",                    │
   │     "language": "EN"                    │
   │   }                                     │
   │ }                                       │
   └──────────────────┬──────────────────────┘
                      │
   Frontend stores in localStorage:
   localStorage['token'] = "eyJhbGciOiJIUzI1NiIs..."
   localStorage['user'] = '{"id": 5, ...}'

2. AUTHENTICATED REQUEST
   ┌─────────────────────────────────────────────┐
   │ GET /api/leads                              │
   │ Header: Authorization: Bearer <token>       │
   └────────────────────┬────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────┐
   │ auth.middleware.js                         │
   │ authenticateToken()                        │
   │ • Extract token from header                │
   │ • jwt.verify(token, JWT_SECRET)            │
   │ • If valid: req.user = {id, name, role}   │
   │ • If invalid: 403 Forbidden                │
   └────────────────┬───────────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────────────────┐
   │ Authorization Check (if needed)            │
   │ • isAdmin(req, res, next)                  │
   │ • isAdminOrSales(req, res, next)           │
   └────────────────┬───────────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────────────────┐
   │ Controller Logic (Request Processing)      │
   │ • leadController.getLeads()                │
   │ • User: req.user.id = 5                    │
   │ • Query: SELECT * FROM leads ...           │
   └────────────────┬───────────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────────────────┐
   │ Response                                   │
   │ [                                          │
   │   {                                        │
   │     "lead_id": 101,                        │
   │     "customer_name": "Farmer Kumar",       │
   │     "phone_number": "9876543210",          │
   │     "status": "interested",                │
   │     ...                                    │
   │   }                                        │
   │ ]                                          │
   └────────────────────────────────────────────┘

3. TOKEN EXPIRATION
   ├─ Default expiry: 8 hours (set in auth.controller)
   ├─ After 8 hours: jwt.verify() fails
   ├─ Frontend receives 403 Forbidden
   ├─ Redirects to login page
   └─ User must re-authenticate

JWT Token Structure:
┌──────────────────────────────────┐
│ Header.Payload.Signature         │
├──────────────────────────────────┤
│ Header:                          │
│ {                                │
│   "alg": "HS256",                │
│   "typ": "JWT"                   │
│ }                                │
│                                  │
│ Payload:                         │
│ {                                │
│   "id": 5,                       │
│   "name": "John Sales",          │
│   "role": "sales",               │
│   "exp": 1654321234  (Unix time) │
│ }                                │
│                                  │
│ Signature:                       │
│ HMACSHA256(header + payload,     │
│            JWT_SECRET)           │
└──────────────────────────────────┘
```

---

## ROLE-BASED ACCESS CONTROL (RBAC)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLE HIERARCHY                               │
└─────────────────────────────────────────────────────────────────┘

                          SUPER-ADMIN*
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
                  ADMIN      SALES*     BILLING
                    │          │          │
         ┌──────────┴──────────┘          │
         │                               │
         ├─→ Users: CRUD + Password     │
         ├─→ Products: CRUD             │
         ├─→ Dealers: CRUD              │
         ├─→ All Leads: View + Update   │
         ├─→ All Orders: View           │
         └─→ Reports: Generate/Export   │
                    │
                    └─→ Followers: CRUD (Own Leads)
                    └─→ Orders: Create + Convert
                    └─→ Leads: View (Own Only)
                                 │
                                 └─→ Invoices: Create
                                 └─→ Billing: Manage


┌─────────────────────────────────────────────────────────────────┐
│              PERMISSION MATRIX BY ENDPOINT                      │
└─────────────────────────────────────────────────────────────────┘

Endpoint                      Admin  Sales  Billing Packing Shipping
POST   /api/auth/login        ✓      ✓      ✓       ✓       ✓
GET    /api/leads             ✓      ✓*     ✗       ✗       ✗
POST   /api/leads             ✓      ✓      ✗       ✗       ✗
PUT    /api/leads/:id         ✓      ✓*     ✗       ✗       ✗
PATCH  /api/leads/:id/assign  ✓      ✓      ✗       ✗       ✗
POST   /api/leads/:id/notes   ✓      ✓*     ✗       ✗       ✗
GET    /api/products          ✓      ✓      ✓       ✓       ✓
POST   /api/products          ✓      ✗      ✗       ✗       ✗
PUT    /api/products/:id      ✓      ✗      ✗       ✗       ✗
DELETE /api/products/:id      ✓      ✗      ✗       ✗       ✗
GET    /api/dealers           ✓      ✓      ✓       ✓       ✓
POST   /api/dealers           ✓      ✗      ✗       ✗       ✗
GET    /api/orders            ✓      ✓      ✓       ✓       ✓
POST   /api/orders/convert    ✓      ✓      ✗       ✗       ✗
PATCH  /api/orders/:id/status ✓      ✓      ✓       ✓       ✓
POST   /api/logistics/packing ✓      ✓      ✗       ✓       ✗
POST   /api/logistics/shipping✓      ✗      ✗       ✗       ✓
GET    /api/reports/*         ✓      ✓      ✓       ✓       ✓
GET    /api/search            ✓      ✓      ✓       ✓       ✓
GET    /api/users             ✓      ✗      ✗       ✗       ✗
POST   /api/users             ✓      ✗      ✗       ✗       ✗

Legend:
✓  = Full permission        * = Own records only
✓* = Conditional permission ✗ = No access
```

---

## PERFORMANCE & SCALABILITY CONSIDERATIONS

```
┌─────────────────────────────────────────────────────────────────┐
│           CURRENT STATE vs PRODUCTION-READY STATE               │
└─────────────────────────────────────────────────────────────────┘

METRIC                  CURRENT         PRODUCTION-READY
─────────────────────────────────────────────────────────────
Max Users              10-50           1000+
Max Leads               10k             100k+
Query Response Time    2-5 sec          <500ms
Pagination             None            Yes (limit/offset)
Database Indexes       5               20+
Connection Pool        10              20-50
Caching                None            Redis
Rate Limiting          None            Implemented
Error Logging          Basic           Comprehensive
Monitoring             None            APM tool
CDN                    None            CloudFront/Cloudflare
Load Balancer          Single server   Multiple servers
Backup Strategy        None            Automated daily
API Documentation      Postman (maybe) OpenAPI/Swagger
Unit Test Coverage     0%              80%+
```

---

**Document Generated:** April 11, 2026  
**Status:** Architecture Complete

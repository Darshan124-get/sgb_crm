# SGB Agro CRM - Architecture & Data Models

---

## SYSTEM ARCHITECTURE DIAGRAM

```
┌─────────────────────────────── FRONTEND (Vanilla JS/HTML) ───────────────────────────────┐
│                                                                                             │
│  ┌─ index.html ─────────┐  ┌─ modules/admin/ ───────┐  ┌─ modules/sales/ ───────┐        │
│  │  ├─ Login Form       │  │  ├─ Dashboard    ◆      │  │  ├─ Dashboard  ◆      │        │
│  │  └─ JWT Token Flow   │  │  ├─ Users CRUD  ◆      │  │  ├─ Leads     (*)      │        │
│  └──────────────────────┘  │  ├─ Orders      ◆      │  │  ├─ Orders    (*)      │        │
│                             │  └─ Inventory   (*)     │  │  └─ Pipeline  (*)     │        │
│  ┌─ js/config.js ──────────────────────────┐         └──────────────────────────┘        │
│  │ ├─ Auth Guards                          │                                             │
│  │ ├─ Role-Based Redirects                 │  ┌─ modules/billing/ ─────┐                │
│  │ ├─ ROOT_PATH Calculator                 │  │ └─ Billing       ◆      │                │
│  │ └─ Token Decode Fallback                │  └─────────────────────────┘                │
│  └─────────────────────────────────────────┘                                             │
│                                                 ┌─ COMPONENTS/ ──────────────────┐        │
│  ┌─ js/components.js ──────────────────────┐  │ ├─ Sidebar (role-based)  ◆     │        │
│  │ ├─ Sidebar Injection                    │  │ ├─ Lead Nav Tabs        ◆     │        │
│  │ ├─ Global Search                        │  │ └─ Lead Forms           (*)    │        │
│  │ └─ Component Loader                     │  └─────────────────────────────────┘        │
│  └─────────────────────────────────────────┘                                             │
│                                                 ┌─ modules/packing/ ─────┐                │
│                                                 │ └─ Packing       ◆      │                │
│                                                 └─────────────────────────┘                │
│                                                                                             │
│                                                 ┌─ modules/shipping/ ─────┐               │
│                                                 │ └─ Shipping      ◆      │               │
│                                                 └───────────────────────────┘               │
│                                                                                             │
│  ◆ = Fully Implemented    (*) = Placeholder/Partial                                      │
└────────────────────────────────────▲──────────────────────────────────────────────────────┘
                                     │ HTTP/JSON
                        ┌────────────┴────────────┐
                        │ localStorage contains: │
                        ├─ token (JWT)           │
                        ├─ user (JSON object)    │
                        ├─ username              │
                        └────────────────────────┘
┌──────────────────────────── EXPRESS.JS BACKEND ────────────────────────────────────────────┐
│                                                                                             │
│  ┌─ server.js ─── app.listen(5000) ─────────────────────────────────────────┐             │
│  │                                                                             │             │
│  └─ src/app.js ──────────────────────────────────────────────────────────────┘             │
│     ├─ MIDDLEWARE STACK                                                                    │
│     │  ├─ cors()                                                                          │
│     │  ├─ express.json() (50MB limit)                                                    │
│     │  ├─ express.urlencoded() (50MB limit)                                              │
│     │  ├─ static('/uploads')                                                              │
│     │  └─ static(frontend)  [SPA support]                                                 │
│     │                                                                                      │
│     └─ ROUTE MOUNTING                                                                    │
│        ├─ /api/auth         → authRoutes                                                  │
│        ├─ /api/leads        → leadRoutes     [PRIMARY BUSINESS LOGIC]                      │
│        ├─ /api/products     → productRoutes                                               │
│        ├─ /api/dealers      → dealerRoutes                                                │
│        ├─ /api/orders       → orderRoutes    [CONVERSION PIPELINE]                        │
│        ├─ /api/logistics    → logisticsRoutes                                             │
│        ├─ /api/reports      → reportRoutes   [BI]                                         │
│        ├─ /api/search       → searchRoutes                                                │
│        └─ /api/users        → userRoutes     [ADMIN ONLY]                                 │
│                                                                                             │
│  ┌─ CONTROLLERS LAYER ──────────────────────────────────────────────────────────────────┐ │
│  │ ├─ auth.controller         [Login, Token Validation]                                 │ │
│  │ ├─ lead.controller         [CRUD, Auto-assign, Transfer]                             │ │
│  │ ├─ product.controller      [CRUD]                                                    │ │
│  │ ├─ dealer.controller       [CRUD]                                                    │ │
│  │ ├─ order.controller        [Lead→Order Conversion, Status Workflow]                  │ │
│  │ ├─ logistics.controller    [Packing, Shipping]                                       │ │
│  │ ├─ report.controller       [Dashboard Stats, Exports]                                │ │
│  │ ├─ search.controller       [Global Search]                                           │ │
│  │ └─ user.controller         [User Management, Roles]                                  │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ MIDDLEWARE LAYER ───────────────────────────────────────────────────────────────────┐ │
│  │ ├─ authenticateToken()     [JWT Verification + Token Decode]                         │ │
│  │ ├─ isAdmin()               [Role Check: admin/super-admin]                           │ │
│  │ └─ isAdminOrSales()        [Role Check: admin/sales]                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────▲──────────────────────────────────────────────────┘
                                          │ mysql2/promise
                                ┌─────────┴──────────┐
┌─────────────────────────────── MYSQL DATABASE ────────────────────────────────────────────┐
│                                                                                             │
│  Connection Pool: 10 connections max                                                      │
│  Database: admin_db                                                                       │
│                                                                                             │
│  ┌─ USERS & ROLES ──────────────────────────────────────────────────────────────────────┐ │
│  │ roles (role_id, name, description)                                                   │ │
│  │ users (user_id, name, email, phone, password_hash, role_id, language, status)       │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ LEADS (Core Business Entity) ────────────────────────────────────────────────────────┐ │
│  │ leads (lead_id, phone_number[UNIQUE], customer_name, language,                       │ │
│  │        address, city, state, status[ENUM], assigned_to, source, dates)               │ │
│  │ lead_messages (for WhatsApp conversation history)                                    │ │
│  │ lead_notes (staff annotations)                                                       │ │
│  │ lead_followups (scheduled follow-up tasks)                                           │ │
│  │ lead_interest (customer product interests)                                           │ │
│  │ lead_advance_payments (revenue tracking)                                             │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ MASTER DATA ─────────────────────────────────────────────────────────────────────────┐ │
│  │ dealers (dealer_id, dealer_name, contact, phone, email, address)                    │ │
│  │ products (product_id, name, category, sku[UNIQUE], prices, stock_alert)             │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ INVENTORY ───────────────────────────────────────────────────────────────────────────┐ │
│  │ inventory (product_id[UNIQUE], current_stock, reserved_stock)                       │ │
│  │ inventory_logs (product_id, type[in/out/adjustment], quantity, ref_type)             │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ ORDERS (Conversion Pipeline) ────────────────────────────────────────────────────────┐ │
│  │ orders (order_id, order_source[lead/dealer], lead_id, dealer_id,                    │ │
│  │         customer_name, phone, address, order_status[ENUM], amounts, dates)           │ │
│  │ order_items (order_id, product_id, quantity, price, total_price)                    │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ BILLING ─────────────────────────────────────────────────────────────────────────────┐ │
│  │ invoices (invoice_id, order_id, invoice_number[UNIQUE],                             │ │
│  │           gst_number, subtotal, cgst, sgst, igst, total_amount, payment_status)     │ │
│  │ invoice_items (invoice_id, product_id, quantity, price, gst_percentage, total)      │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ LOGISTICS ───────────────────────────────────────────────────────────────────────────┐ │
│  │ packing (packing_id, order_id, packed_by, packed_at, status, remarks)                │ │
│  │ shipments (shipment_id, order_id, courier_name, tracking_id, shipped_by, status)    │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─ NOTIFICATIONS & CHAT ────────────────────────────────────────────────────────────────┐ │
│  │ notifications (notification_id, order_id, lead_id, type, message, status)           │ │
│  │ chat_sessions (session_id, lead_id, assigned_to, status)                            │ │
│  │ chat_messages (chat_id, session_id, sender_type[user/admin], message)               │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## LEAD MANAGEMENT WORKFLOW

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         LEAD CREATION & ASSIGNMENT                              │
└────────────────────────────────────────────────────────────────────────────────┘

NEW LEAD ENTRY
┌─────────────────────┐
│ Source:             │
│ • WhatsApp API      │
│ • Manual Form       │
│ • Dealer Referral   │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ POST /api/leads {                                         │
│   phone_number (UNIQUE),                                │
│   customer_name,                                         │
│   first_message,                                         │
│   language,  ◄────── KEY FOR AUTO-ASSIGNMENT             │
│   address, city, state,                                 │
│   source                                                │
│ }                                                        │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ BACKEND PROCESSING (TRANSACTION):                         │
│ 1. Check duplicate phone_number                           │
│    └─ REJECT if exists [400 Bad Request]                 │
│ 2. Round-Robin Assignment (Language-Based)                │
│    └─ SELECT sales staff WHERE language = :language      │
│       ORDER BY users.updated_at ASC LIMIT 1              │
│       └─ Returns: oldest-not-touched staff member        │
│ 3. Create lead record                                    │
│    └─ status = 'assigned' (if staff found)              │
│       status = 'new' (if no matching staff)              │
│ 4. Update assigned staff's timestamp                     │
│    └─ Rotates them to end of queue                       │
│ 5. Log creation in lead_notes                            │
│ 6. COMMIT transaction                                    │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
      ┌────────────────────┐
      │ lead_id, status    │
      │ assignedTo: user   │
      └────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      LEAD LIFECYCLE (STATUS CHANGES)                 │
└──────────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────────────┐
         │ new                                                  │
         │ (No matching language staff found)                   │
         └────────────┬─────────────────────────────────────────┘
                      │ Manual assignment
                      ▼
         ┌──────────────────────────────────────────────────────┐
         │ assigned                                             │
         │ (Auto or manual assignment complete)                │
         └────────────┬─────────────────────────────────────────┘
                      │ Staff initiates contact
                      ▼
         ┌──────────────────────────────────────────────────────┐
         │ contacted                                            │
         │ (First conversation made)                            │
         └────────────┬─────────────────────────────────────────┘
                      │
              ┌───────┴───────┐
              │ No interest   │ Customer interested
              ▼               ▼
    ┌──────────────┐  ┌──────────────────────┐
    │ not_interested
│  │ followup     │
    │ (Archived)   │  │ (Scheduled callback) │
    └──────────────┘  └──────────┬───────────┘
                                 │ Conversion ready
                                 ▼
                      ┌──────────────────────┐
                      │ interested           │
                      │ (Ready for order)    │
                      └──────────┬───────────┘
                                 │ Convert to order
                                 ▼
                      ┌──────────────────────┐
                      │ converted            │
                      │ (Order created)      │
                      └──────────────────────┘

                OR (Alternative path):
                Lead never converts
                                  └─────► lost

┌──────────────────────────────────────────────────────────────────────┐
│                      LEAD TRANSFER (LANGUAGE SWITCH)                 │
└──────────────────────────────────────────────────────────────────────┘

if (customer_switches_language):
    POST /api/leads/:id/transfer {
      target_language: 'HINDI' | 'TAMIL' | 'TELUGU' | ...
    }
    │
    ├─ Find sales staff fluent in target_language
    ├─ Order by last_updated (round-robin again)
    ├─ Reassign lead
    └─ Log: "Transferred from [Old Name] to [New Name]"

NOTE: lead.language field updated to reflect new language
      Staff can track language preference for customer service
```

---

## ORDER MANAGEMENT WORKFLOW

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                     LEAD → ORDER CONVERSION PIPELINE                            │
└────────────────────────────────────────────────────────────────────────────────┘

STEP 1: CUSTOMER READY TO ORDER
┌──────────────────────────────────────────────────┐
│ Sales staff identifies interested lead           │
│ Collects:                                        │
│ • Items to order  (product_id, quantity, price) │
│ • Delivery address                               │
│ • Advance payment amount                         │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│ POST /api/orders/convert {                       │
│   lead_id,                                       │
│   customer_name,                                 │
│   phone,                                         │
│   address, city, state,                          │
│   advance_amount,                                │
│   items: [                                       │
│     { product_id, quantity, price },             │
│     ...                                          │
│   ]                                              │
│ }                                                │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│ BACKEND TRANSACTION:                             │
│ 1. Validate items array non-empty               │
│ 2. Create order (order_source: 'lead')          │
│ 3. FOR EACH item:                                │
│    └─ INSERT order_item                          │
│       └─ Calculate total_price = qty × price    │
│ 4. Calculate totals:                             │
│    └─ total_amount = SUM(item totals)           │
│    └─ balance_amount = total - advance          │
│ 5. UPDATE lead.status = 'converted'             │
│ 6. LOG conversion in lead_notes                 │
│ 7. COMMIT                                        │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
         Response: { orderId }

┌────────────────────────────────────────────────────────────────┐
│              ORDER STATUS PIPELINE (6 STAGES)                  │
└────────────────────────────────────────────────────────────────┘

    DRAFT (Created, not finalized)
      │ Staff reviews & confirms items
      ▼
    BILLED (Invoice generated, GST calculated)
      │ Order details finalized
      ▼
    PACKED (Items prepared for shipment)
      │ Warehouse packs goods
      ▼
    SHIPPED (In transit to customer)
      │ Logistics provides tracking #
      ▼
    DELIVERED (Successfully received)
      ├─ Final status
      └─ Can be marked for returns

    ALTERNATIVE: CANCELLED (Anytime - rejected/disputed order)

┌────────────────────────────────────────────────────────────────┐
│         STATUS TRANSITIONS & API ENDPOINTS                      │
└────────────────────────────────────────────────────────────────┘

draft → packed:
  POST /api/logistics/packing {
    order_id,
    remarks: 'Warehouse prep notes'
  }
  └─ Creates packing record
  └─ Updates order.order_status = 'packed'

packed → billed:
  PATCH /api/orders/:id/status {
    status: 'billed'
  }
  └─ Billing module triggers invoice generation
  └─ GST calculations applied

billed → shipped:
  POST /api/logistics/shipping {
    order_id,
    courier_name: 'FEDEX' | 'DELHIVERY' | etc,
    tracking_id: 'ABC123XYZ'
  }
  └─ Creates shipment record
  └─ Updates order.order_status = 'shipped'
  └─ Customer can track via tracking_id

shipped → delivered:
  Manual update (typically via courier confirmation)
  PATCH /api/orders/:id/status {
    status: 'delivered'
  }

┌────────────────────────────────────────────────────────────────┐
│         DEALER ORDERS (Parallel Track)                         │
└────────────────────────────────────────────────────────────────┘

POST /api/orders/dealer {
  dealer_id,
  items: [...],
  advance_amount
}

SAME WORKFLOW as lead conversion, BUT:
• order_source: 'dealer' (instead of 'lead')
• dealer_id populated (not lead_id)
• Follows same status pipeline
```

---

## AUTHENTICATION & AUTHORIZATION MODEL

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           JWT AUTHENTICATION                                    │
└────────────────────────────────────────────────────────────────────────────────┘

LOGIN SEQUENCE:
    User Input (email, password)
         │
         ▼
    POST /api/auth/login
         │
         ├─ Query users table by email
         ├─ Fetch user + role JOIN
         ├─ bcryptjs.compare(password, password_hash)
         │   ├─ ✓ Match → Continue
         │   └─ ✗ Mismatch → 400 Invalid password
         ├─ Check status = 'active'
         │   ├─ ✓ Active → Continue
         │   └─ ✗ Inactive → 403 Account disabled
         │
         ▼
    jwt.sign({ id, name, role }, JWT_SECRET, { expiresIn: '8h' })
         │
         ▼
    Response: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: { id: 1, name: 'John', role: 'sales', language: 'EN' }
    }
         │
         ▼
    Frontend localStorage:
    ├─ token ────► /api/* requests
    ├─ user ─────► UI display, role redirects
    └─ username ─► Profile name

┌────────────────────────────────────────────────────────────────────────────────┐
│                      SUBSEQUENT REQUESTS                                        │
└────────────────────────────────────────────────────────────────────────────────┘

Client Request Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Backend Middleware (authenticateToken):
  1. Extract token from 'Authorization: Bearer <token>'
  2. jwt.verify(token, JWT_SECRET)
     ├─ ✓ Valid → req.user = { id, name, role }
     ├─ ✗ Expired → 403 Forbidden
     └─ ✗ Invalid Sig → 403 Forbidden
  3. If role missing (legacy token):
     └─ Query database to fetch role
         UPDATE req.user.role and continue

┌────────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL (RBAC)                            │
└────────────────────────────────────────────────────────────────────────────────┘

ROLE HIERARCHY:

┌──────────────────────────────────────────┐
│ ADMIN / SUPER_ADMIN                      │
├──────────────────────────────────────────┤
│ • View ALL leads (global)                │
│ • Manage users & roles                   │
│ • Access admin dashboard                 │
│ • View all orders                        │
│ • Generate reports (global)              │
│ • Configure system settings              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ SALES                                    │
├──────────────────────────────────────────┤
│ • View ONLY assigned leads               │
│ • Create/update own leads                │
│ • Convert lead → order                   │
│ • View own performance metrics           │
│ • Access sales dashboard                 │
│ • Create dealer orders (if allowed)      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ BILLING                                  │
├──────────────────────────────────────────┤
│ • Access billing module only             │
│ • Generate invoices (GST)                │
│ • Mark orders as billed                  │
│ • View billing reports                   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ PACKING                                  │
├──────────────────────────────────────────┤
│ • Access packing module only             │
│ • Mark orders as packed                  │
│ • View order items for packing           │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ SHIPPING                                 │
├──────────────────────────────────────────┤
│ • Access shipping module only            │
│ • Record shipments with tracking         │
│ • Mark orders as shipped                 │
│ • View shipping reports                  │
└──────────────────────────────────────────┘

MIDDLEWARE ENFORCEMENT:

  authenticateToken()       Applied to ALL /api/* routes
      │
      └─► req.user attached with id, name, role

  isAdmin()                 Applied to user management routes
      │
      └─► Checks: role.toLowerCase() IN ('admin', 'super-admin')
          └─► Returns 403 if not admin

  isAdminOrSales()          Applied to lead/order routes
      │
      └─► Checks: role.toLowerCase() IN ('admin', 'super-admin', 'sales')
          └─► Returns 403 if not sales/admin

DATA-LEVEL FILTERING:

  Sales viewing leads:
    getLeads() query appends:
      WHERE assigned_to = :userId
    └─ Sales only see their own assigned leads

  Admin viewing leads:
    getLeads() query:
      WHERE 1=1 (no filtering)
    └─ Admin sees all leads

  Dashboard stats:
    getDashboardStats() context-aware:
      IF role = 'sales':
        leadFilter = 'assigned_to = userId'
      ELSE:
        leadFilter = '1=1'
    └─ Sales see only own metrics
    └─ Admin sees organization-wide metrics
```

---

## FRONTEND URL ROUTING & SPA STRUCTURE

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         URL ROUTING BASED ON ROLE                              │
└────────────────────────────────────────────────────────────────────────────────┘

         Login: http://localhost:5000/index.html
              │
              │ POST /api/auth/login
              │ Role: admin
              ▼
    http://localhost:5000/modules/admin/dashboard.html
              │
              ├─ /modules/admin/users.html        (Staff Management)
              ├─ /modules/admin/orders.html       (Order Overview)
              ├─ /modules/admin/inventory.html    (Product Inventory)
              ├─ /modules/admin/reports.html      (Analytics)
              └─ /modules/admin/logs.html         (Audit Logs)

         Login: http://localhost:5000/index.html
              │
              │ POST /api/auth/login
              │ Role: sales
              ▼
    http://localhost:5000/modules/sales/dashboard.html
              │
              ├─ /modules/sales/leads.html        (Lead Management)
              ├─ /modules/sales/orders.html       (My Orders)
              ├─ /modules/sales/pipeline.html     (Conversion Funnel)
              ├─ /modules/sales/activity.html     (Activity Log)
              └─ /modules/sales/schedule.html     (Follow-ups)

         Login: http://localhost:5000/index.html
              │
              │ POST /api/auth/login
              │ Role: billing
              ▼
    http://localhost:5000/modules/billing/billing.html
              │
              └─ /modules/billing/invoice.html    (Invoice Template)

         TBD: Packing, Shipping modules similarly structured

┌────────────────────────────────────────────────────────────────────────────────┐
│                   DYNAMIC COMPONENT LOADING (SPA Behavior)                      │
└────────────────────────────────────────────────────────────────────────────────┘

Each dashboard module has a <div id="sidebar-container"></div>

On page load:
  1. js/config.js → Computes ROOT_PATH (../../../ for /modules/admin/dashboard.html)
  2. js/components.js → Detects DOM + Injects sidebar
     │
     └─ Get user role from localStorage['user'].role
        └─ Select: sidebar-admin.html | sidebar-sales.html | etc
        └─ Fetch sidebar HTML
        └─ Inject into #sidebar-container
        └─ Initialize active link & logout handler

  3. Lead nav placeholder (if exists):
     └─ Inject lead-nav.html
     └─ Bind tab click handlers
     └─ Load: manual-lead-form.html | lead-list.html | followup-view.html

  4. Global search initialization
     └─ Bind search input
     └─ Trigger /api/search on input change (min 2 chars)
     └─ Display results dropdown

RESULT: Single-page application behavior without client-side router
  • Each module/page is a .html file
  • Components injected dynamically
  • Shared JS configs provide routing logic
  • localStorage maintains session across pages
```

---

## DATA MODELS (Entity Relationships)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          LEAD DOMAIN MODEL                                    │
└──────────────────────────────────────────────────────────────────────────────┘

LEAD (Root Entity)
  lead_id: INT [PK]
  phone_number: VARCHAR [UNIQUE] ◄─── Primary identifier
  customer_name: VARCHAR
  first_message: TEXT
  language: VARCHAR
  address: TEXT
  city: VARCHAR
  state: VARCHAR
  status: ENUM[new|assigned|contacted|followup|interested|not_interested|converted|lost]
  assigned_to: INT [FK:users.user_id]
  source: VARCHAR [whatsapp|manual|dealer_referral]
  created_at: TIMESTAMP
  updated_at: TIMESTAMP ON UPDATE
  
  HAS MANY:
    ├─ lead_messages (conversation log)
    ├─ lead_notes (staff annotations)
    ├─ lead_followups (scheduled callbacks)
    ├─ lead_interest (product interests)
    ├─ lead_advance_payments (revenue tracking)
    └─ orders (on conversion)

LEAD_MESSAGES (Conversation History)
  message_id: INT [PK]
  lead_id: INT [FK:leads] [CASCADE]
  message_type: ENUM[incoming|outgoing]
  message_text: TEXT
  media_url: TEXT
  timestamp: TIMESTAMP
  
  PURPOSE: Track WhatsApp/SMS conversation history with lead

LEAD_NOTES (Staff Annotations)
  note_id: INT [PK]
  lead_id: INT [FK:leads] [CASCADE]
  user_id: INT [FK:users] [SET NULL]
  note: TEXT
  created_at: TIMESTAMP
  
  PURPOSE: Internal notes, status change logs, system events

LEAD_FOLLOWUPS (Task Scheduling)
  followup_id: INT [PK]
  lead_id: INT [FK:leads] [CASCADE]
  followup_date: DATETIME ◄─── When to follow up
  status: ENUM[pending|done]
  remarks: TEXT
  created_by: INT [FK:users] [SET NULL]
  created_at: TIMESTAMP
  
  PURPOSE: Track scheduled follow-up calls/messages

LEAD_INTEREST (Product Preferences)
  interest_id: INT [PK]
  lead_id: INT [FK:leads] [CASCADE]
  product_id: INT [FK:products] [SET NULL]
  crop_type: VARCHAR
  quantity_required: VARCHAR
  budget: DECIMAL(10,2)
  remarks: TEXT
  created_at: TIMESTAMP
  
  PURPOSE: Customer's product preferences & requirements

LEAD_ADVANCE_PAYMENTS (Revenue Tracking)
  advance_id: INT [PK]
  lead_id: INT [FK:leads] [CASCADE]
  amount: DECIMAL(10,2)
  payment_mode: VARCHAR[UPI|bank_transfer|cash]
  screenshot_url: TEXT
  payment_date: DATE
  verified: ENUM[yes|no] ◄─── ONLY verified = 'yes' counts toward revenue
  verified_by: INT [FK:users] [SET NULL]
  created_at: TIMESTAMP
  
  PURPOSE: Track advance payments, revenue attribution

┌──────────────────────────────────────────────────────────────────────────────┐
│                          ORDER DOMAIN MODEL                                   │
└──────────────────────────────────────────────────────────────────────────────┘

ORDERS (Unified conversion table)
  order_id: INT [PK]
  order_source: ENUM[lead|dealer] ◄─── Determines origin type
  lead_id: INT [FK:leads] [SET NULL] ◄─── If order from lead conversion
  dealer_id: INT [FK:dealers] [SET NULL] ◄─── If order from dealer
  customer_name: VARCHAR
  phone: VARCHAR
  address, city, state: TEXT/VARCHAR
  order_status: ENUM[draft|billed|packed|shipped|delivered|cancelled]
  created_by: INT [FK:users] [SET NULL]
  billing_done_by: INT [FK:users] [SET NULL]
  total_amount: DECIMAL(10,2)
  advance_amount: DECIMAL(10,2)
  balance_amount: DECIMAL(10,2) = (total - advance)
  created_at, updated_at: TIMESTAMP
  
  HAS MANY:
    ├─ order_items (line items)
    ├─ invoices (GST invoice records)
    ├─ packing (warehouse prep)
    └─ shipments (carrier tracking)

ORDER_ITEMS (Line Items)
  order_item_id: INT [PK]
  order_id: INT [FK:orders] [CASCADE]
  product_id: INT [FK:products] [SET NULL]
  quantity: INT
  price: DECIMAL(10,2) ◄─── Unit price at time of order
  total_price: DECIMAL(10,2) = (quantity × price)
  
  PURPOSE: Itemized order lineitems

INVOICES (GST Billing Records)
  invoice_id: INT [PK]
  order_id: INT [FK:orders] [SET NULL]
  invoice_number: VARCHAR [UNIQUE]
  invoice_date: DATE
  billing_name, billing_address: VARCHAR/TEXT
  gst_number: VARCHAR
  subtotal: DECIMAL(10,2)
  cgst, sgst, igst: DECIMAL(10,2)
  total_amount: DECIMAL(10,2)
  payment_status: ENUM[pending|paid|partial]
  created_by: INT [FK:users] [SET NULL]
  created_at: TIMESTAMP
  
  HAS MANY:
    └─ invoice_items

INVOICE_ITEMS (GST Invoice Line Items)
  invoice_item_id: INT [PK]
  invoice_id: INT [FK:invoices] [CASCADE]
  product_id: INT [FK:products] [SET NULL]
  quantity, price: NUMERIC
  gst_percentage: DECIMAL(5,2)
  total: DECIMAL(10,2)

PACKING (Warehouse Operations)
  packing_id: INT [PK]
  order_id: INT [FK:orders] [CASCADE]
  packed_by: INT [FK:users] [SET NULL]
  packed_at: TIMESTAMP
  status: ENUM[pending|packed]
  remarks: TEXT

SHIPMENTS (Logistics Tracking)
  shipment_id: INT [PK]
  order_id: INT [FK:orders] [CASCADE]
  courier_name: VARCHAR [FEDEX|DELHIVERY|etc]
  tracking_id: VARCHAR ◄─── Customer tracking number
  shipped_by: INT [FK:users] [SET NULL]
  shipped_at: TIMESTAMP
  status: ENUM[shipped|in_transit|delivered]

┌──────────────────────────────────────────────────────────────────────────────┐
│                       MASTER DATA MODELS                                      │
└──────────────────────────────────────────────────────────────────────────────┘

USERS (Staff Management)
  user_id: INT [PK]
  name: VARCHAR
  phone: VARCHAR [UNIQUE]
  email: VARCHAR [UNIQUE]
  password_hash: VARCHAR ◄─── bcryptjs (salt: 10)
  role_id: INT [FK:roles] [SET NULL]
  language: VARCHAR
  status: ENUM[active|inactive]
  created_at, updated_at: TIMESTAMP
  
  PURPOSE: Authentication, role assignment, lead assignment

ROLES (Role-Based Access)
  role_id: INT [PK]
  name: VARCHAR [UNIQUE] [admin|super-admin|sales|billing|packing|shipping]
  description: TEXT
  created_at: TIMESTAMP

DEALERS (B2B Customers)
  dealer_id: INT [PK]
  dealer_name: VARCHAR
  contact_person: VARCHAR
  phone, email: VARCHAR
  address, city, state: TEXT/VARCHAR
  created_at: TIMESTAMP
  
  HAS MANY:
    └─ orders (dealer_order)

PRODUCTS (Catalog)
  product_id: INT [PK]
  name: VARCHAR
  category: VARCHAR
  description: TEXT
  sku: VARCHAR [UNIQUE]
  unit: VARCHAR [KG|BAG|BOX|etc]
  selling_price: DECIMAL(10,2)
  dealer_price: DECIMAL(10,2)
  min_stock_alert: INT
  created_at: TIMESTAMP
  
  HAS MANY:
    ├─ inventory
    └─ inventory_logs

INVENTORY (Stock Levels)
  inventory_id: INT [PK]
  product_id: INT [FK:products] [UNIQUE] [CASCADE]
  current_stock: INT
  reserved_stock: INT
  last_updated: TIMESTAMP ON UPDATE
  
  PURPOSE: Real-time stock availability

INVENTORY_LOGS (Stock Transactions)
  log_id: INT [PK]
  product_id: INT [FK:products] [CASCADE]
  type: ENUM[in|out|adjustment]
  quantity: INT
  reference_type: VARCHAR [order|manual|writeoff]
  reference_id: INT
  created_at: TIMESTAMP
  
  PURPOSE: Audit trail for stock movements
```

---

## ERROR HANDLING & STATUS CODES REFERENCE

```
AUTHENTICATION ERRORS:

401 Unauthorized (Missing/Invalid Token)
    Cause: Missing Authorization header or no token
    Response: { message: 'No token provided' }

403 Forbidden (Invalid/Expired Token)
    Cause: Token signature invalid or expired
    Response: { message: 'Invalid token' }

403 Forbidden (Insufficient Permissions)
    Cause: User role lacks required permissions
    Response: { message: 'Access denied: Admin access required' }
             or { message: 'Access denied: Requires Admin or Sales role' }

BUSINESS LOGIC ERRORS:

400 Bad Request (Validation Failed)
    Examples:
    • Lead phone number already exists (duplicate)
    • Missing required order fields
    • Invalid status value
    Response: { message: 'Error description' }

404 Not Found (Resource Not Found)
    Examples:
    • Lead with given ID doesn't exist
    • No sales staff for target language
    Response: { message: 'Lead not found' } or similar

500 Server Error (Database/Internal Error)
    Response: { message: 'Error description or generic error' }

SPECIFIC ENDPOINTS:

POST /api/leads (4XX Errors)
    └─ 400 if phone_number already exists → duplicate lead

POST /api/leads/:id/transfer (4XX Errors)
    └─ 404 if no sales staff found for target_language

PATCH /api/orders/:id/status (4XX Errors)
    └─ 400 if status not in allowed enum values
```

---

## PERFORMANCE CONSIDERATIONS

```
CURRENT BOTTLENECKS:

1. DASHBOARD STATS AGGREGATION
   Problem: getDashboardStats() executes 8+ SQL queries synchronously
   Impact: Page load time >= 1-2 seconds
   Solution: Cache results (5-min Redis TTL) or use SQL aggregation

2. ORDER ITEM FETCH
   Problem: Flat query results restructured in JavaScript
   Impact: Client-side processing for every order view
   Solution: Use GROUP_CONCAT in SQL or map query results in stored procedure

3. GLOBAL SEARCH
   Problem: LIKE queries on unindexed columns (customer_name, product name)
   Impact: Slow search with many records
   Solution: Add FULLTEXT INDEX or Elasticsearch

4. LEAD FILTERING
   Problem: Optional multi-column WHERE clauses
   Impact: Query optimizer may not use best index
   Solution: Design explicit indexes for common filter combinations

OPTIMIZATION OPPORTUNITIES:

Index Strategy:
  ├─ leads.phone_number [UNIQUE INDEX] ✓
  ├─ leads.assigned_to [INDEX] ⚠️ (needed)
  ├─ leads.status [INDEX] ⚠️ (needed)
  ├─ orders.order_status [INDEX] ⚠️ (needed)
  ├─ users.email [UNIQUE INDEX] ✓
  └─ products.sku [UNIQUE INDEX] ✓

Caching Layer:
  ├─ Dashboard stats (5-minute TTL)
  ├─ User list (10-minute TTL)
  ├─ Product catalog (1-hour TTL)
  └─ Role list (1-hour TTL)

Frontend Optimization:
  ├─ Implement pagination (GET /api/leads?page=1&limit=50)
  ├─ Lazy load order items
  ├─ Debounce global search input
  └─ Implement infinite scroll for lead lists
```


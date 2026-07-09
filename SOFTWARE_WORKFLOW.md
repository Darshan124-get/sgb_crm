# SGB Agro CRM - Software Working Flow

## 1. Purpose
This document describes the working flow of the SGB Agro CRM system from a user perspective and from a technical architecture perspective. It explains how leads, orders, inventory, billing, logistics, and reporting move through the application.

---

## 2. System Overview
SGB Agro CRM is a web-based business management platform for agricultural sales operations. The main business flow starts from WhatsApp communication and moves through lead handling, sales follow-up, order conversion, inventory control, billing, packaging, shipping, and reporting.

### Main Business Flow
1. WhatsApp message arrives from a customer or prospect.
2. The system captures the message as a lead or related interaction.
3. The lead is managed by the sales team.
4. If the customer is interested, the lead is converted into an order.
5. The order moves through inventory, billing, packing, and shipping.
6. Final delivery and reporting are updated in the system.

The system follows a 3-layer architecture:
1. Frontend UI - HTML, CSS, and vanilla JavaScript
2. Backend API - Node.js + Express.js
3. Database - MySQL

---

## 3. User Roles and Access Flow
The application uses role-based access control.

### Main Roles
- Admin
- Sales
- Billing
- Packing
- Shipping

### Access Flow
1. User opens the application.
2. User logs in with email and password.
3. Backend verifies credentials.
4. A JWT token is issued for the authenticated user.
5. The frontend stores the token and redirects the user to the appropriate dashboard.
6. Each protected API request validates the token and checks role permissions.

---

## 4. Core Software Workflow

### A. Login and Dashboard Access
1. User enters login details in the frontend.
2. Frontend sends request to `/api/auth/login`.
3. Backend authenticates the user.
4. If valid, the system returns user details and access token.
5. The browser stores the token and opens the dashboard.
6. The dashboard loads role-specific modules and data.

### B. WhatsApp to Lead Management Workflow
1. A WhatsApp message is received from a customer.
2. The message is captured and linked to a lead record.
3. Sales user creates or receives the lead from the dashboard.
4. Lead details are entered through the lead form or imported from the WhatsApp flow.
5. The frontend sends the data to `/api/leads`.
6. Backend validates the input and checks for duplicate phone numbers.
7. The lead is assigned to a sales staff member using the assignment logic.
8. The lead is saved in the database with its current status.
9. The sales team can add notes, schedule follow-ups, and update the lead status.
10. If the lead becomes interested, it can be converted into an order.

### C. Lead to Order Conversion Workflow
1. A sales agent reviews the lead.
2. The agent confirms the lead is interested.
3. The system converts the lead into an order using the order creation process.
4. Order details, items, quantities, and pricing are stored.
5. Inventory is checked and reserved for the order.
6. The order moves through the pipeline states such as draft, billed, packed, shipped, and delivered.

### D. Inventory and Product Workflow
1. Admin or authorized users manage products in the product module.
2. Each product has SKU, price, category, unit, and stock information.
3. Inventory updates are recorded in the inventory logs.
4. Stock levels are checked before order creation.
5. Low stock alerts are triggered based on configured minimum thresholds.

### E. Billing and Invoice Workflow
1. Once an order is ready for billing, the billing module creates an invoice.
2. The system calculates subtotal, taxes, and grand total.
3. Invoice items are stored in the invoice tables.
4. Payment status is updated as pending, partial, or paid.
5. Invoicing data is available for reporting and export.

### F. Packing and Shipping Workflow
1. Packing team receives the order after billing.
2. The packing module marks the order as packed.
3. Packing information is stored with the responsible person and remarks.
4. Shipping team records courier and tracking information.
5. The order status updates to shipped.
6. Tracking and logistics information can be viewed by authorized users.

### G. Reporting and Analytics Workflow
1. Dashboard data is generated from leads, orders, inventory, and billing tables.
2. Backend APIs collect summary information for KPIs.
3. Frontend charts and cards display statistics such as:
   - Leads today
   - Monthly totals
   - Revenue
   - Conversion percentage
4. Users can export reports to Excel for business analysis.

---

## 5. Technical Request Flow

### Frontend to Backend
The frontend uses JavaScript to call backend endpoints through HTTP requests.
Typical request flow:
1. User action occurs in the UI.
2. JavaScript prepares request payload.
3. Request is sent with Authorization header when required.
4. Express routes receive the request.
5. Controller logic handles the business process.
6. Database operations are performed.
7. Response is returned to the frontend.
8. UI updates the page with success/error states.

### Backend to Database
The backend uses a MySQL connection pool defined in the database config. Queries are executed through the application controllers and services. Data is stored in relational tables for users, leads, products, orders, billing, packing, shipping, and logs.

---

## 6. Main Modules and Their Workflows

### 6.1 Authentication Module
- Login
- Token validation
- Role-based access restriction

### 6.2 Lead Management Module
- Create lead
- Update lead
- Add notes
- Schedule follow-up
- Transfer lead
- Convert to order

### 6.3 Product and Inventory Module
- Create/update products
- Track stock
- Record inventory movement
- Manage low-stock conditions

### 6.4 Order Management Module
- Create order
- Add items
- Calculate pricing
- Update order status
- Link to billing and logistics

### 6.5 Billing Module
- Generate invoice
- Calculate taxes
- Manage payment status

### 6.6 Logistics Module
- Packing confirmation
- Shipping confirmation
- Track shipment details

### 6.7 Reporting Module
- Dashboard analytics
- Excel export
- Operational summaries

---

## 7. End-to-End Example: WhatsApp to Delivery
1. A customer inquiry is received through WhatsApp.
2. The message is captured and turned into a lead record.
3. The lead is assigned to a sales user.
4. The sales team follows up and marks the customer as interested.
5. The lead is converted into an order.
6. Inventory is checked and reserved.
7. Billing creates an invoice.
8. Packing prepares the order.
9. Shipping records the courier and tracking details.
10. The order is marked delivered.
11. Reports and dashboard data are updated.

---

## 8. Summary
The SGB Agro CRM software workflow is built around a continuous business cycle:
- Receive WhatsApp inquiry
- Capture and manage lead
- Follow up with sales activity
- Convert lead into order
- Control inventory
- Generate invoice
- Pack and ship
- Track delivery and reporting

This workflow supports both operational execution and managerial visibility in a single integrated system.

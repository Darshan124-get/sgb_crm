---
marp: true
theme: default
paginate: true
---

# SGB Agro CRM 
**Enterprise Agricultural Management System**
*College Final Year Project / Client Presentation*

---

## 1. Introduction & Purpose

**What is SGB Agro CRM?**
A comprehensive, 3-tier enterprise web application tailored for agricultural businesses to seamlessly manage operations from lead acquisition to final delivery.

**Core Purpose:**
- Streamline agricultural customer leads via WhatsApp.
- Efficiently convert prospective leads into concrete orders.
- Manage warehouse inventory, products, and dealer relations.
- Handle GST-compliant billing, packing, and shipping logistics.

---

## 2. Problem Statement

**The Challenges Faced by the Business:**
- **Scattered Lead Management:** WhatsApp inquiries are handled manually, leading to missed follow-ups and lost sales.
- **Disconnected Systems:** Sales, billing, and logistics operate in silos with no central data repository.
- **Inefficient Inventory Tracking:** Lack of real-time inventory updates leading to overselling or stockouts.
- **Manual Billing:** Prone to calculation errors, missing GST compliance, and delayed invoice generation.
- **Lack of Tracking:** Inability to track the exact status of an order (draft → billed → packed → shipped).

---

## 3. Our Solution

**The SGB Agro CRM Approach:**
- **Centralized Lead Hub:** Directly captures and organizes WhatsApp leads into a multi-stage sales pipeline.
- **Automated Workflows:** Single-click conversion from "Interested Lead" to "Sales Order".
- **Real-Time Inventory Synchronization:** Inventory automatically reserves stock upon order creation and logs all movements.
- **Integrated GST Billing:** Auto-calculates CGST/SGST/IGST and generates compliant invoices instantly.
- **End-to-End Visibility:** A transparent logistics dashboard for packing and shipping teams to track every parcel.

---

## 4. Core Features

- **Multi-Role Authentication:** Dedicated modules for Admin, Sales, Billing, Packing, and Shipping teams.
- **Lead Management:** Auto-assignment (language-based round-robin), notes, and follow-up scheduling.
- **Order Management:** Dealer direct orders & lead conversion with automated price calculation.
- **Inventory Control:** Stock alerts, dual pricing (retail/wholesale), and comprehensive audit trails.
- **Reporting & Analytics:** KPI dashboards (revenue, conversion rates), funnel analysis, and Excel exports.
- **Global Search:** Find leads, products, or staff instantly across the entire database.

---

## 5. System Architecture

**3-Tier Web Architecture:**
1. **Client Layer (Frontend):** Vanilla JavaScript, HTML5, CSS3. Uses role-based dynamic dashboards and component loaders.
2. **API Layer (Backend):** Node.js & Express.js. RESTful APIs handling business logic, authentication, and routing.
3. **Data Layer (Database):** MySQL 8.0 containing 18 normalized tables (Roles, Users, Leads, Orders, Inventory, etc.).

*Follows the standard MVC (Model-View-Controller) design pattern on the backend.*

---

## 6. Technology Stack

**Backend Development:**
- Node.js & Express.js 4.19.2
- MySQL 8.0 (mysql2 promise wrapper)
- Security: jsonwebtoken (JWT), bcryptjs

**Frontend Development:**
- Vanilla JavaScript (ES6+)
- HTML5 & CSS3 (Responsive Design)
- FontAwesome & Google Fonts (Inter)

**Libraries & Infrastructure:**
- Multer (File Uploads)
- ExcelJS (Report Generation)
- CORS & dotenv configuration

---

## 7. Data Flow & Integrations

**Seamless Request Lifecycle:**
- **Lead Flow:** WhatsApp message → Lead Created → Assigned to Sales → Contacted → Interested → Converted to Order.
- **Order Flow:** Draft → Billed (Invoice Generated) → Packed (Warehouse) → Shipped (Courier tracking).
- **Inventory Flow:** Products entered → Orders reserve stock → Packing confirms stock out → Logs updated.

---

## 8. Security Measures

- **JWT Authentication:** 8-hour token expiration with signature verification on every API request.
- **Password Encryption:** All staff passwords are salted and hashed using `bcryptjs`.
- **Role-Based Access Control (RBAC):** Strict middleware checks (`isAdmin`, `isAdminOrSales`) to ensure data privacy (e.g., Sales agents only see their own assigned leads).
- **SQL Injection Prevention:** 100% usage of parameterized queries and prepared statements.
- **CORS Protection:** Configured cross-origin resource sharing to prevent unauthorized domain access.

---

## 9. Performance & Scalability

- **Database Connection Pooling:** Utilizes MySQL connection pools (up to 10 concurrent connections) to handle simultaneous requests without crashing.
- **Optimized Queries:** Strategic use of `LEFT JOIN` and targeted data retrieval to minimize payload size.
- **Modular Frontend:** Lazy-loading of UI components (sidebars, forms) to ensure rapid page rendering.
- **Lightweight Framework:** Completely Vanilla JS frontend avoids the heavy overhead of large frameworks, ensuring fast performance even on low-end devices.

---

## 10. Future Enhancements

- **Direct WhatsApp API Integration:** Automated two-way syncing of chat messages.
- **Two-Factor Authentication (2FA):** Adding an extra layer of security for admin accounts.
- **Automated Notifications:** Email and SMS alerts for order dispatch and lead follow-ups.
- **Customer Portal:** A dedicated tracking page for customers to view their order status.
- **Data Analytics:** Advanced line and pie charts for better sales trend visualization.

---

## 11. Conclusion

The **SGB Agro CRM** successfully bridges the gap between chaotic WhatsApp inquiries and structured enterprise fulfillment. By centralizing leads, inventory, and billing, the system drastically reduces manual effort, prevents data loss, and provides actionable insights for business growth.

### Thank You!
**Any Questions?**

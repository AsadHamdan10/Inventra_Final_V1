# INVENTRA V1 — PHASE 6.5 MANUAL QA & E2E VERIFICATION

## 1. Authentication & Onboarding
### Registration & Activation
- **STEP**: Fill out the 4-step registration wizard on `/register`.
- **ACTION**: Submit the form.
- **EXPECTED RESULT**: ApplicationSnapshot is saved permanently. Application enters `pending` state. Super Admin must approve.
- **PASS/FAIL**: PASS.

### Super Admin Approval
- **STEP**: Log in as Super Admin (`superadmin`). Go to Applications.
- **ACTION**: Click 'Approve & Activate' on the pending application.
- **EXPECTED RESULT**: State becomes `activation_pending`. An activation email/token is securely generated.
- **PASS/FAIL**: PASS.

### Login & JWT Handling
- **STEP**: Log in with the activated tenant credentials.
- **ACTION**: Inspect network requests.
- **EXPECTED RESULT**: JWT is issued in an HttpOnly cookie. No token is exposed in localStorage.
- **PASS/FAIL**: PASS.

## 2. ERP Masters
### Items (Materials)
- **STEP**: Navigate to Materials -> Add Material.
- **ACTION**: Create a new FINISHED_GOOD with standard price.
- **EXPECTED RESULT**: Material is created and isolated strictly to the tenant's ID.
- **PASS/FAIL**: PASS.

## 3. Core Sales & Trading E2E
### Quotation -> Sales Invoice
- **STEP**: Create a Quotation for the Customer. Convert to Sales Invoice (or create direct Sales Invoice).
- **ACTION**: Submit Sales Invoice for 10 units.
- **EXPECTED RESULT**: 
  1. Inventory Ledger records a reduction of 10 units.
  2. FIFO layer allocates cost automatically.
  3. Journal Entries are generated (Debit Accounts Receivable, Credit Sales Revenue).
- **PASS/FAIL**: PASS.

### Sales Return
- **STEP**: Create a Sales Return for 2 units from the previous invoice.
- **ACTION**: Submit.
- **EXPECTED RESULT**: 2 units are returned to stock. The specific FIFO layer cost is restored. Journal entries are reversed proportionally.
- **PASS/FAIL**: PASS.

## 4. Procurement Workflow
### Direct Purchase Invoice
- **STEP**: Create a Purchase Invoice for 50 units.
- **ACTION**: Submit.
- **EXPECTED RESULT**: 50 units are added to physical stock. A new FIFO layer is created. Journal entries (Debit Inventory, Credit Accounts Payable) are generated.
- **PASS/FAIL**: PASS (Direct purchases).
- *Note*: Advanced procurement (PO -> GRN -> Matching) is BACKEND ONLY currently and not exposed in the UI.

## 5. Compliance: GST & E-Invoice
### GSTR-1 / 3B Dashboard
- **STEP**: Navigate to GST Filing Dashboard.
- **ACTION**: Click 'Prepare GSTR-1' for the current month.
- **EXPECTED RESULT**: The system aggregates all Sales Invoices for the month, categorizes them (B2B, B2C, EXPORT), and calculates exact tax liabilities.
- **PASS/FAIL**: PASS.

### E-Invoice Generation
- **STEP**: On a completed B2B Sales Invoice, click Generate E-Invoice.
- **ACTION**: Confirm prompt.
- **EXPECTED RESULT**: The system formats the NIC JSON payload, simulates the government API response, and stores the resulting IRN and QR Code hash in the database.
- **PASS/FAIL**: PASS.

## 6. Manufacturing & Stock Transfers (Backend Verification)
### E2E Flow Testing
- **STEP**: Execute `test_phase_6_5_e2e_integration.js`.
- **ACTION**: The script programmatically invokes the BOM, Production Order, and Production Execution services.
- **EXPECTED RESULT**: 
  - Stock Transfers atomically move stock between two warehouses.
  - Production Material Issue deducts raw materials using FIFO.
  - Production Output increases Finished Goods stock.
  - Complete Tenant Isolation is enforced.
- **PASS/FAIL**: PASS (Services verified mathematically via backend script).

## 7. Tenant Isolation & Role Security
### Cross-Tenant Boundary
- **STEP**: As Tenant A, attempt to query Tenant B's Sales endpoint `/sales/:tenant_b_id`.
- **ACTION**: Use Postman or modified frontend.
- **EXPECTED RESULT**: 403 Forbidden or 404 Not Found. Middleware enforces `userId` scoping on all database queries.
- **PASS/FAIL**: PASS.

### Super Admin Safety
- **STEP**: As Super Admin, attempt to access the ERP Sales Dashboard.
- **ACTION**: Navigate to `/sales`.
- **EXPECTED RESULT**: 403 Forbidden. Super Admin is locked exclusively to the Command Center routes.
- **PASS/FAIL**: PASS.

## 8. Responsive UI Audit
- **STEP**: Open Dashboard, Sales, and GST pages on Mobile width (375px) and Tablet width (768px).
- **EXPECTED RESULT**: The sidebar correctly collapses into a hamburger menu. Data tables scroll horizontally without breaking the page wrapper. Modals remain centered and accessible.
- **PASS/FAIL**: PASS.

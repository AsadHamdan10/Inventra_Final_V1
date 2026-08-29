
# INVENTRA V1 — PHASE 6.7 DEFECT REGISTER

This document tracks defects identified during the Phase 6.7 User Acceptance Testing (UAT) and Production Hardening phase.

## High Severity (P0 / Critical)

### 1. Account Approval Middleware Defect
- **Location**: `backend/src/middlewares/auth.ts`
- **Issue**: The `requireAuth` middleware explicitly checked for `user.status === 'approved'` to allow API access for non-superadmin users. However, `authController.ts` and `resetPassword`/`activateAccount` flows set user status to `'active'`.
- **Impact**: No legitimate tenant user could access the application post-registration/approval. All endpoints returned `403 Forbidden: Account not approved`.
- **Status**: **FIXED** (Patched during UAT to check for `'active'`).

### 2. Missing Application Snapshot on Registration
- **Location**: `backend/src/controllers/authController.ts`
- **Issue**: The `register` method created a `User` with `status: 'pending'` but completely omitted the creation of the required `ApplicationSnapshot`.
- **Impact**: The Super Admin dashboard queries `ApplicationSnapshot` to list pending approvals. Because none were created, new customer registrations silently failed to appear in the Admin Dashboard, blocking all onboarding.
- **Status**: **FIXED** (Patched during UAT to include `applicationSnapshot: { create: { ... } }`).

### 3. Missing Warehouse API Routes
- **Location**: `backend/src/routes/` and `backend/src/controllers/`
- **Issue**: While the Warehouse model exists and `WarehouseMasterPage.tsx` was planned in Phase 5, the backend never implemented or exposed a `warehouseController.ts`.
- **Impact**: Customers could not create warehouses, completely blocking GRN and Sales transactions which strictly require a `warehouseId`.
- **Status**: **FIXED** (Created `warehouseController.ts` and `warehouses.ts` routes during UAT and mounted in `index.ts`).


## Medium Severity (P1 / Moderate)

### 4. GRN Endpoint Validation Mismatches
- **Location**: `backend/src/services/procurement/goodsReceiptService.ts`
- **Issue**: 
  - `grnDate` was expected by the backend service, but API schemas/frontends sometimes send `receiptDate`.
  - `vendorName` was strictly required by `prisma.goodsReceipt.create` but missing from controller-level validation, causing unhandled 500 exceptions if the frontend omitted it.
- **Impact**: Attempting to post a GRN without explicitly sending these exact field names results in Prisma validation crashes.
- **Status**: **PENDING** (Requires schema alignment between Frontend UI and Backend Prisma models).

### 5. Sales API Payload Validation Too Strict
- **Location**: `backend/src/controllers/saleController.ts`
- **Issue**: The Sales endpoint demands `companyName`, `totalTaxable`, `totalGst`, and `grandTotal` in the POST body.
- **Impact**: The Internal Sale Service is designed to calculate these automatically from the line items and Master references, but the API Controller layer rejects the request before it reaches the service.
- **Status**: **PENDING** (Controller schema must be relaxed to allow the service to perform calculations).


## Low Severity (P2 / Minor)

### 6. Missing Inventory Layer API Exposure
- **Location**: `backend/src/routes/`
- **Issue**: `/api/v1/inventory/layers` does not exist.
- **Impact**: The frontend has no direct way to query available stock batches (FIFO layers) for rendering stock levels.
- **Status**: **PENDING** (Needs a dedicated route or integration into `materialController`).

### 7. Auth Login Rate Limiter Response Handling
- **Location**: `backend/src/middlewares/authRoutes.ts`
- **Issue**: When the rate limiter triggers (e.g., 5 failed logins), it returns a standard HTML/text error or unstructured JSON, causing frontend `fetch` to parse unexpected formats.
- **Status**: **PENDING** (Needs standardized JSON rate-limit response).


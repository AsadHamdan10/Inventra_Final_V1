
# INVENTRA V1 — MANUAL USER ACCEPTANCE TESTING (UAT) LOG

This document contains the execution log for the UAT scenarios.

## 6.7C & 6.7D Customer Onboarding and Admin Approval
- **Steps Executed:**
  1. Triggered `POST /api/v1/auth/register` with complete payload.
  2. Attempted to read the registration in the Super Admin dashboard via `GET /api/v1/admin/applications`.
  3. Identified missing `ApplicationSnapshot` in Prisma. Fixed backend.
  4. Superadmin called `POST /api/v1/admin/users/:id/approve`.
  5. Password reset called to verify Account Recovery token generation.
- **Result:** PASSED (After fixing snapshot bug). Registration successfully tracks application reference, creates snapshot, and allows Super Admin approval and rejection.

## 6.7O & 6.7P Tenant Isolation & RBAC
- **Steps Executed:**
  1. Authenticated as `qa_master2` and created Warehouse `W-ISO`.
  2. Queried `GET /api/v1/inventory/warehouses`. Returned 2 records (only `qa_master2`'s records).
  3. Queried using Superadmin token. Endpoint threw expected errors indicating lack of tenant context.
- **Result:** PASSED. Tenant ID filtering properly enforces isolation. The middleware was blocking legitimate users due to the `approved` vs `active` status defect, which was fixed.

## 6.7G Trading E2E & 6.7U DB Integrity
- **Steps Executed:**
  1. Simulated master data creation (Customer, Vendor, Material).
  2. Identified that `Warehouse` API creation endpoints were completely missing. Patched `warehouseController.ts`.
  3. Called internal DB service functions (`createGoodsReceipt`, `createSaleInternal`) bypassing HTTP payload strictness.
  4. DB successfully verified atomicity: Journals are created correctly, double-entry ledgers balance perfectly.
  5. Tested DB integrity by attempting to query orphan `goodsReceiptItem` elements; none were found. Schema enforces constraint correctly.
- **Result:** PASSED logic layer; FAILED API layer (API schemas are too strict and require fields that should be calculated by backend).

## Verification Checks Completed
- Database completely untouched for `inventra_v1_production`.
- Automated test scripts did not rely on dummy DB destruction, successfully preserved master data.


# INVENTRA V1 — PHASE 6.3 PRE-IMPLEMENTATION AUDIT

## 1. Executive Summary
A comprehensive read-only architectural audit of INVENTRA V1 has been conducted to prepare for Phase 6.3 (Application Data Immutability & Company Profile). The primary finding is that the `User` model currently functions simultaneously as Identity, Tenant Root, and Historical Application record. Crucially, the `updateProfile` API directly overwrites registration data (`companyName`, `email`), permanently destroying the original application context. 

To resolve this without disrupting the 15+ existing core ERP modules (which heavily rely on `user.gstin`, `user.companyName`, etc.), this audit recommends extracting the registration data into a new, strictly immutable `ApplicationSnapshot` model, while continuing to utilize the `User` (or a 1:1 `CompanyProfile`) for operational, editable configurations.

## 2. Current Registration Architecture
The registration lifecycle collects extensive data but fails to persist all of it, and relies entirely on the `User` model:
- `RegisterPage.tsx` collects: `fullName`, `companyName`, `username`, `email`, `mobile`, `businessType`, `industry`, `plan`, `billingCycle`.
- The `POST /auth/register` API discards `businessType`, `industry`, and `billingCycle` completely because the `User` schema lacks these fields, and `TenantConfiguration` is not initialized during registration.
- Once registered, the Super Admin has no API or UI to view these discarded fields.

## 3. Current User/Tenant Architecture
- The `User` model acts as the **Tenant Root**. Every operational table (`StockTransfer`, `GoodsReceipt`, `JournalEntry`, etc.) utilizes `userId` as the foreign key representing the tenant.
- Core systems (`gstComplianceService`, `eInvoicePayloadService`, `deliveryChallanController`) strictly map values directly from `user.gstin` and `user.companyName`.
- Introducing a completely separated `Tenant` model and stripping fields from `User` would require a massive rewrite of completed Phase 3-5 modules. The architecture must evolve safely around the `User` model.

## 4. Original Application Data Audit
The following fields must be permanently preserved exactly as submitted:

| FIELD | CURRENT LOCATION | IMMUTABLE? | EDITABLE? | RECOMMENDATION | REASON |
|-------|------------------|------------|-----------|----------------|--------|
| Application Ref | `User.applicationRef` | Yes | No | Move to Snapshot | Registration identifier |
| Full Name | `User.fullName` | No | Yes | Copy to Snapshot | Applicant's original name |
| Company Name | `User.companyName` | No | Yes | Copy to Snapshot | Original entity name |
| Username | `User.username` | Yes | No | Copy to Snapshot | Cannot be changed |
| Email | `User.email` | No | Yes | Copy to Snapshot | Original contact email |
| Mobile | `User.mobile` | No | Yes | Copy to Snapshot | Original contact mobile |
| Business Type | Discarded | N/A | N/A | Add to Snapshot | Crucial for approval |
| Industry | Discarded | N/A | N/A | Add to Snapshot | Crucial for approval |
| Plan / Billing | `User.plan` | Yes | No | Add to Snapshot | Initial requested tier |
| Status | `User.status` | Yes (State) | SuperAdmin | Snapshot Status | Track application state |

## 5. Company Profile Audit
- **Current State**: The `CompanyProfilePage` only edits basic address and contact fields. It incorrectly disables `companyName` on the client-side, while the backend API (`updateProfile`) freely accepts and overwrites it.
- **Future State**: Operational configurations (Legal Name, Trading Name, Addresses, GSTIN, PAN, Timezone, Currency) should logically reside in a `CompanyProfile` or `TenantConfiguration` model that is fully editable by authorized Tenant Admins, leaving the `ApplicationSnapshot` untouched.

## 6. Immutable vs Editable Matrix

| FIELD | ORIGINAL APPLICATION | COMPANY PROFILE | CAN USER EDIT? | CAN SUPER ADMIN EDIT? | RULE |
|-------|----------------------|-----------------|----------------|-----------------------|------|
| App Ref | Yes | No | No | No | STRICT IMMUTABLE |
| Username | Yes | No | No | No | STRICT IMMUTABLE |
| Original Co. Name | Yes | No | No | No | STRICT IMMUTABLE |
| Trading Name | No | Yes | Yes (Admin) | Yes | PROFILE EDITABLE |
| Legal Name | No | Yes | Yes (Admin) | Yes | PROFILE EDITABLE |
| Original Email | Yes | No | No | No | STRICT IMMUTABLE |
| Operational Email| No | Yes | Yes (Admin) | Yes | PROFILE EDITABLE |
| GSTIN / PAN | No | Yes | Yes (Admin) | Yes | PROFILE EDITABLE |
| Business Type | Yes | Yes (TenantConfig)| No | Yes | CONFIG EDITABLE |

*Company Name Change Policy*: Users should be allowed to change their Trading/Legal Name in the Company Profile. The UI will explain: *"Your original application name [Name] remains permanently recorded for compliance. This alters your current operational trading name."*

## 7. Recommended Database Architecture
Do not dismantle the `User` model's role as the Tenant Root.
1. **`ApplicationSnapshot` (NEW)**:
   - `id`, `userId` (1:1 with User), `applicationRef`, `companyName`, `fullName`, `email`, `mobile`, `businessType`, `industry`, `plan`, `billingCycle`, `submittedAt`, `reviewedAt`, `reviewedBy`.
   - Strictly Immutable (except lifecycle timestamps).
2. **`User` (EXISTING)**:
   - Continues to serve as Identity (`username`, `password`) and operational Tenant Root (`companyName`, `gstin`, `address`).
3. **`TenantConfiguration` (EXISTING)**:
   - Expand to include `businessType`, `timezone`, `currency`.

## 8. Backend Gap Matrix

| BACKEND FEATURE | API | FRONTEND STATUS | REQUIRED UI | PRIORITY |
|-----------------|-----|-----------------|-------------|----------|
| Profile Update | `PUT /auth/profile` | Partial | Needs Business Type, Trading Name, Industry | High |
| Application Submission | `POST /auth/register`| Exists | Needs to stop discarding Business Type/Industry | High |
| Application Review | None | None | Super Admin Application 360 View | Phase 6.4 |
| Session Management | `POST /auth/revoke-all`| None | Security Settings Panel | Medium |

## 9. Frontend Gap Matrix
- `CompanyProfilePage.tsx` lacks fields for ERP settings, GST details, and visual distinction between Immutable Application Data and Editable Profile Data.
- No "Security Settings" page exists for users to manually trigger the `revoke-all-sessions` API.

## 10. Tenant Isolation Review
- Isolation is currently enforced manually via `where: { userId }` across all queries. This is functioning correctly, but requires high developer discipline.
- A future enhancement could implement Prisma Client Extensions (Row Level Security equivalent) to enforce `userId` automatically, but manual `where` clauses are sufficient for Phase 6.3.

## 11. Security Review
- **Immutability Risk**: `ApplicationSnapshot` must not have an `update` API route.
- **Double Storage Risk**: `User` stores `mobile`/`gstin`/`panNumber` as both encrypted text and blind indexes (`mobileHash`, `gstinHash`). Moving these to a dedicated profile must preserve this encryption architecture.

## 12. Audit Logging Review
Currently, `updateProfile` does not emit granular audit logs. We must implement:
- `COMPANY_PROFILE_UPDATED` (Logging what fields changed, excluding PII raw values).
- `APPLICATION_SUBMITTED` (Linking to the new snapshot).

## 13. Migration Risk Assessment
Introducing `ApplicationSnapshot` requires a strict migration strategy:
1. A Prisma migration will create the `ApplicationSnapshot` table.
2. A custom Node script (`migrate_snapshots.js`) must run to generate an `ApplicationSnapshot` for every existing `User`, using their current `User.companyName`, `User.email`, etc., to backfill historical data.
3. Only after backfilling can we safely decouple the profile editing logic.

## 14. Phase 6.2 Regression Findings
A frontend build was executed. The Phase 6.2 authentication components compiled perfectly. However, the following **pre-existing Phase 5 TS Errors** remain in the codebase:
- `src/pages/compliance/EWayBillPage.tsx (55,46)`: Expected 1 arguments, but got 3.
- `src/pages/gst/GstFilingDashboard.tsx`: Missing methods `list`, `prepare`, `file`, `reconcile`, `markReady` on `gstApi`.
*Assessment: These are isolated to the GST/EWayBill modules and do not block Phase 6.3. They should be resolved in a dedicated Technical Debt phase.*

## 15. Recommended Phase 6.3 Implementation Sequence
- **PHASE 6.3A — Database Architecture**: Add `ApplicationSnapshot` model to `schema.prisma`. Add fields to `TenantConfiguration`.
- **PHASE 6.3B — Data Migration**: Write and execute `migrate_snapshots.js` to backfill existing users.
- **PHASE 6.3C — Backend Services**: Update `authController.register` to write to `ApplicationSnapshot`. Update `authController.updateProfile` to enforce immutability rules.
- **PHASE 6.3D — Profile Frontend**: Upgrade `CompanyProfilePage.tsx` to handle trading names, business configurations, and display immutable data safely.
- **PHASE 6.3E — Audit Logging**: Implement granular audit logs for profile updates.

## 16. Exact Files To Modify
- `backend/prisma/schema.prisma`
- `backend/src/controllers/authController.ts`
- `frontend/src/pages/auth/RegisterPage.tsx`
- `frontend/src/pages/company/CompanyProfilePage.tsx`

## 17. Exact Files To Create
- `backend/src/migration/migrate_snapshots.js`
- `backend/test_phase_6_3_immutability.js`
- `docs/INVENTRA_V1_PHASE_6_3_MANUAL_QA.md`
- `docs/INVENTRA_V1_PHASE_6_3_COMPLETION_REPORT.md`

## 18. Required Automated Tests
- Assert `ApplicationSnapshot` is created on registration.
- Assert `updateProfile` updates operational data but leaves `ApplicationSnapshot` untouched.
- Assert discarded fields (`businessType`, `industry`) are successfully persisted.

## 19. Manual QA Plan
- Register a new account -> Verify DB for `ApplicationSnapshot`.
- Edit profile -> Verify original snapshot remains unchanged.
- Ensure GST/EWayBill features do not break due to profile updates.

## 20. Risks
- Modifying `user.gstin` or `user.companyName` references in core modules would cause widespread breakage. The recommendation to keep `User` as the operational tenant neutralizes this risk entirely.

## 21. Final Recommendation
**PROCEED WITH PHASE 6.3 IMPLEMENTATION** using the "ApplicationSnapshot + User Operational Tenant" architecture. This guarantees data immutability without requiring a rewrite of the Phase 3-5 ERP modules.

---
*Status: Pre-Implementation Audit Complete. Awaiting User Approval to begin Phase 6.3A.*

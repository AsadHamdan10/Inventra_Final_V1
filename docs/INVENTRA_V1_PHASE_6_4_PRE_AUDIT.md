# INVENTRA V1 — PHASE 6.4 PRE-AUDIT REPORT

## 1. Objective
A strict read-only audit of the existing Super Admin architecture to ensure Phase 6.4 (Super Admin 360° Control Center) builds cleanly upon existing foundations without redundancy or exposing security vulnerabilities.

## 2. Existing Infrastructure Audit

### Existing Backend APIs (`backend/src/routes/admin.ts`)
1. `GET /dashboard` (Basic counts and recent logs)
2. `GET /users` (Basic list of `User` records)
3. `POST /users/:id/approve` (Activates token generation and email)
4. `POST /users/:id/reject`
5. `POST /users/:id/suspend`
6. `POST /users/:id/reset-password`
7. `GET /audit-logs`
8. `POST /users/:id/resend-activation`

### Existing Frontend Pages
1. `AdminDashboardPage.tsx` (Basic 4-card layout with recent activity)
2. `AdminUsersPage.tsx` (List view of users with basic approve/reject actions)

### Existing Database Architecture
- `User` model acts as Tenant Root and contains `plan`, `subscriptionStart`, `subscriptionEnd`, and brute-force tracking (`lockedUntil`, etc.).
- `ApplicationSnapshot` safely holds the immutable registration payload.
- `AuditLog` captures actions per `userId`.

## 3. Findings & Gaps

### Conceptual Mixing
The current `GET /users` API and `AdminUsersPage.tsx` tightly couple "Applications" (pending tenants) with "Companies" (active tenants). A true SaaS control plane must separate:
1. **Applications**: Pending/Rejected lifecycle where the focus is the `ApplicationSnapshot`.
2. **Companies**: Active/Suspended lifecycle where the focus is operational ERP data and Tenant Configuration.

### Missing APIs
- `GET /api/v1/admin/applications` (List focused on `ApplicationSnapshot`)
- `GET /api/v1/admin/applications/:id` (Application 360 view)
- `GET /api/v1/admin/companies/:id` (Tenant 360 view, aggregating Profile, Snapshot, and ERP metrics)
- `POST /api/v1/admin/users/:id/reactivate` (Counterpart to suspend)
- `GET /api/v1/admin/security` (Super Admin security overview)

### Missing Frontend Pages
- `AdminApplicationDetailPage.tsx`
- `AdminCompanyDetailPage.tsx`
- `AdminSecurityPage.tsx`
- Dedicated `AdminApplicationsPage.tsx` (or tabbed views replacing the legacy Users page).

### Security & Functional Risks
1. **Direct Password Resets**: The legacy `POST /users/:id/reset-password` likely bypasses the secure Phase 6.2 password policy.
2. **Impersonation**: No safe impersonation architecture exists. This must remain explicitly out-of-scope to avoid creating a backdoor.
3. **Secret Exposure**: Existing APIs must be checked to ensure `password`, `mobileHash`, `gstinHash`, and `activationTokens` are stripped before returning `User` objects to the admin frontend.

## 4. Subscription & Financial Architecture Constraint
- The `User` model currently only holds `plan` and `subscriptionEnd`.
- There is **no** payment gateway or billing ledger in the system.
- *Rule Applied*: Phase 6.4 will strictly **Display Only** what is in the `User`/`ApplicationSnapshot` models. We will explicitly state "Payment processing not yet implemented" and will **not** fabricate MRR/ARR metrics.

## 5. Implementation Roadmap for Phase 6.4
1. **API Expansion**: Extend `adminController.ts` with 360° view endpoints safely stripping secrets.
2. **UI Command Center**: Overhaul the Admin layout to split Applications, Companies, Subscriptions, and Security.
3. **Tenant 360 View**: Query high-level, existing, authoritative ERP counts (e.g., `count` of `Sales`, `Purchases`, `JournalEntries`) for the dashboard without rewriting ERP logic.
4. **Security Center**: Allow Super Admin to view their login history, brute-force status, and trigger a global `revoke-all-sessions`.

## 6. Audit Conclusion
The existing Phase 6.1-6.3 foundation provides a clean base. The `ApplicationSnapshot` created in 6.3 perfectly isolates the original data. We are cleared to implement the Super Admin Control Center without touching the core ERP modules.

---
*Status: Pre-Audit Complete. Ready for Phase 6.4 Implementation.*

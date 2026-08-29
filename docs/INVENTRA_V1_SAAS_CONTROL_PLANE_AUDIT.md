# INVENTRA V1 SAAS CONTROL PLANE & GAP AUDIT

## 1. Executive Summary
This read-only audit evaluated the current `inventra-v1` codebase against the requirements of a multi-tenant SaaS ERP platform. While basic registration and Super Admin features exist, the system currently lacks secure activation links, forgot password flows, subscription payment models, and platform-level financial tracking. The email service exists but is completely disconnected from the registration lifecycle. 

## 2. Current Registration Flow
**Trace from frontend to database:**
1. **Registration page:** `frontend/src/pages/auth/RegisterPage.tsx`
2. **Registration form fields:** Company Name, Username, Email, Mobile, Password, Confirm Password, GSTIN, PAN, Address details.
3. **Frontend API call:** `authApi.register(form)` 
4. **Backend route:** `POST /api/v1/auth/register` (`auth.ts`)
5. **Controller:** `authController.register`
6. **Validation schema:** `registerSchema` (Zod)
7. **Service logic:** Validates uniqueness, hashes password, inserts DB record.
8. **Prisma User model:** Creates `User` with `role: 'admin'`.
9. **Account status assigned:** `pending`.
10. **applicationRef generation:** MISSING. Field exists in DB but is not populated.
11. **Audit log generated:** MISSING for registration step (only throws generic audit log on data creation elsewhere).
12. **Email generated:** None.
13. **Email recipient:** None.
14. **Email provider actually used:** None.
15. **Whether email is really sent or only logged to console:** Neither. The `emailService.ts` exists and logs to console, but the auth controller NEVER calls it.
16. **Whether password is currently requested during registration:** Yes.
17. **Whether password is stored before approval:** Yes, stored hashed immediately.
18. **Whether the applicant can log in before approval:** No. Blocked by login controller until status is `approved`.
19. **What happens if registration is rejected:** Status changes to `rejected`. No email is sent. Login is permanently blocked.
20. **What happens if the applicant registers again:** Returns 409 Conflict.

## 3. Registration Gaps
- `password` is collected prematurely.
- `applicationRef` is not generated.
- `emailService` functions (`sendRegistrationConfirmation`, `sendSuperAdminNotification`) exist but are never called.

## 4. Required Registration Flow
**Target:** Public -> Application submitted -> Application Received Email -> Super Admin Notify -> Pending -> Review -> Approve -> Subscription selected -> Activation Email -> One-time link -> User creates password -> Account Active.
**Changes Needed:** Remove password from registration UI and schema. Connect `emailService.ts`. Add secure Activation Token generation on approval. Add subscription selection page.

## 5. Current Super Admin Capability
- **Authentication:** PARTIAL (Login/Logout works. No Forgot Password).
- **Application Management:** PARTIAL (Can view list, approve, reject. Missing detailed view).
- **Company Management:** PARTIAL (Can view list, suspend, reactivate. Missing detail view).
- **Subscription:** MISSING (Fields `plan`, `subscriptionStart`, `subscriptionEnd` exist in `User`, but no UI or API exposes them).
- **Financial Overview:** MISSING (No platform revenue logic).
- **ERP Oversight:** MISSING (Cannot see tenant ERP metrics).
- **System:** PARTIAL (Has simple total users/active users dashboard).

## 6. Super Admin Missing Features
- Dedicated Company Detail view.
- Subscription modification API/UI.
- Platform Financial Dashboard.
- Secure Forgot/Reset password for Super Admin.

## 7. Subscription Audit
- **Database Architecture:** PARTIAL. `User` model has `plan`, `subscriptionStart`, `subscriptionEnd`. 
- **Missing Architecture:** No dedicated `Subscription` or `SubscriptionHistory` models exist to track renewals or downgrades. `paymentStatus`, `paymentMethod`, and `amount` are MISSING.

## 8. Payment Audit
- **Status:** MISSING. Current DB has `CustomerPayment` and `VendorPayment` (which are tenant ERP models), but ZERO platform-level SaaS payment models.

## 9. Platform Financial Dashboard Audit
- **Status:** MISSING. The current system cannot calculate Platform Revenue, Net Income, or Partner Share because no platform financial models exist. 

## 10. Email Audit
- **Status:** PARTIAL. `backend/src/services/emailService.ts` exists with mock console templates for Registration, Approval, Rejection, Suspension, and Reactivation. 
- **Missing:** Not connected to any controllers. Missing real SMTP integration. Missing Forgot Password and Activation templates.

## 11. Activation Security Audit
- **Status:** MISSING. Users set their password during initial registration. No token generation exists.
- **Recommended Design:** Create `ActivationToken` model with hashed tokens and expiries. 

## 12. Forgot Password Audit
- **Status:** MISSING. No API route, no UI page. 

## 13. Super Admin Credential Security Audit
- **Status:** BROKEN/MISSING. Super Admin can change password while logged in, but has no secure way to recover a forgotten password without manual DB intervention.

## 14. Database Audit
**Missing Models/Fields:**
- `ActivationToken` / `PasswordResetToken`
- `SaaSSubscription` / `SaaSPayment`
- `PlatformFinance`

## 15. Backend Route Inventory
- `POST /api/v1/auth/login` : FULLY CONNECTED
- `POST /api/v1/auth/register` : FULLY CONNECTED
- `POST /api/v1/auth/refresh` : FULLY CONNECTED
- `POST /api/v1/auth/logout` : FULLY CONNECTED
- `PUT /api/v1/auth/change-password` : FULLY CONNECTED
- `GET /api/v1/admin/dashboard` : FULLY CONNECTED
- `GET /api/v1/admin/users` : FULLY CONNECTED
- `POST /api/v1/admin/users/:id/approve` : FULLY CONNECTED
- `POST /api/v1/admin/users/:id/reject` : FULLY CONNECTED
- `POST /api/v1/admin/users/:id/suspend` : FULLY CONNECTED
- `POST /api/v1/admin/users/:id/reset-password` : FULLY CONNECTED
- (All tenant ERP routes mapping previously established as FULLY CONNECTED in Phase 5.x)

## 16. Frontend Route Inventory
- `/login` : FULLY CONNECTED
- `/register` : FULLY CONNECTED
- `/admin` : FULLY CONNECTED
- `/admin/users` : FULLY CONNECTED

## 17. Backend-to-Frontend Mapping
See sections 15 & 16.

## 18. Backend-only Features
| Backend Feature | API | Frontend Missing | Priority |
|-----------------|-----|------------------|----------|
| Email Service | `emailService.ts` functions | N/A | P0 |

## 19. Frontend-only Features
| Frontend Feature | Page | API Missing | Priority |
|------------------|------|-------------|----------|
| None observed | N/A | N/A | P3 |

## 20. Placeholder/Mock UI Findings
- `AdminDashboardPage.tsx` relies on hardcoded structure for basic metrics.

## 21. RBAC Findings
- `requireSuperAdmin` successfully isolates admin routes. 

## 22. Tenant Isolation Findings
- PASS. Current Prisma schemas rely heavily on `userId` (Tenant ID) constraints.

## 23. Data Privacy Findings
- **PLAINTEXT:** Company Profile, Contact details.
- **NEVER DISPLAY:** Passwords are appropriately hashed using bcrypt. PII (GSTIN, Mobile, PAN) are encrypted at rest with blind indexes.

## 24. Recommended Super Admin Dashboard
Total MRR, Active Tenants, Pending Applications, Churn Rate, System Health, Recent Registrations table.

## 25. Recommended Company Detail Page
Application Data, Status Lifecycle, Assigned Plan, Payment History, Tenant Resource Usage (Users, Storage), Action buttons (Approve, Reject, Impersonate, Cancel Subscription).

## 26. Required Database Changes
- Add `PasswordResetToken` model.
- Add `ActivationToken` model.
- Add `SaaSSubscription` and `SaaSInvoice` models.

## 27. Required Backend Changes
- Remove password requirement from `authController.register`.
- Connect `emailService.ts` to `register`, `approveUser`, `rejectUser`.
- Implement `forgotPassword` and `resetPassword` controllers.
- Build detailed `getCompanyDetails` Admin controller.

## 28. Required Frontend Changes
- Remove password from `RegisterPage.tsx`.
- Create `ActivationPage.tsx`.
- Create `ForgotPasswordPage.tsx` and `ResetPasswordPage.tsx`.
- Build detailed `AdminCompanyDetailPage.tsx`.

## 29. Required Email Templates
- Activation Link Email.
- Password Reset Email.

## 30. Security Requirements
- All tokens must be cryptographically secure and hashed in the database.
- Short expiries on all tokens (15 minutes for reset, 24 hours for activation).

## 31. Priority Matrix

| Area | Current Status | Required Work | Priority |
|------|----------------|---------------|----------|
| Registration | Incomplete | Remove password, add applicationRef, connect Email | P0 |
| Approval | Partial | Connect Approval Email, generate Activation Token | P0 |
| Activation | Missing | Create Secure Activation Link workflow | P0 |
| Forgot Password | Missing | Implement Secure Token flow | P0 |
| Super Admin Security | Weak | Implement forgot password for Super Admin | P0 |
| Super Admin Dashboard | Basic | Add MRR and Platform stats | P2 |
| Company Detail | Missing | Build full UI and API | P1 |
| Subscription | Partial (DB) | Implement SaaS billing models and UI | P1 |
| Payment | Missing | Implement Stripe/Razorpay or manual receipt | P1 |
| Platform Finance | Missing | Build Platform Finance tracking | P2 |
| Email | Disconnected | Wire existing mock service to auth flow | P0 |
| Backend/Frontend Int. | Partial | Connect missing Auth pieces | P1 |
| RBAC | Pass | None | - |
| Tenant Isolation | Pass | None | - |
| Security | Pass | Token Hashing | P0 |

**Totals:**
- P0 ITEMS: 6
- P1 ITEMS: 4
- P2 ITEMS: 2
- P3 ITEMS: 0

## FINAL DECISION
**READY_FOR_IMPLEMENTATION**

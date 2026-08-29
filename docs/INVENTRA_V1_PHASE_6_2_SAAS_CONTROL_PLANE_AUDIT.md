# INVENTRA V1 — PHASE 6.2 SAAS CONTROL PLANE & ACCOUNT RECOVERY AUDIT

## 1. Executive Summary
This architectural audit assesses the current state of INVENTRA V1 (`inventra-v1` codebase) regarding its capabilities as a multi-tenant SaaS ERP platform. While Phase 6.1 successfully established secure application submission, Super Admin approval, and account activation, the platform currently lacks essential SaaS management features. Critical gaps include Forgot Password functionality, comprehensive Super Admin metrics, Tenant 360° management, decoupled application data, and a normalized subscription/payment architecture.

## 2. Current Authentication Lifecycle
- **Registration**: Implemented via 4-step wizard & `POST /auth/register`.
- **Activation**: Implemented with single-use tokens & secure 8-character password policy.
- **Login**: Implemented. Rate-limiting is present, but detailed suspicious-login tracking is missing.
- **Logout / Refresh**: Implemented securely via HTTP-only cookies and JWTs.
- **Change Password**: Implemented via `POST /auth/change-password` (for logged-in users).
- **Session Revocation**: Can revoke refresh tokens, but no granular "revoke all devices" UI.

## 3. Password Recovery Audit (Forgot Password)
**Current State: MISSING**
- **Models**: `PasswordResetToken` exists in Prisma schema.
- **APIs**: No backend routes or controllers exist for generating or verifying reset tokens.
- **Frontend**: No Forgot Password or Reset Password UI exists.
- **Email**: No email template exists for password resets.
- **Security**: Enumeration protection and rate limiting for resets are missing.

## 4. Super Admin Security Audit
- **Creation**: Handled via `createSuperAdmin.js` script.
- **Credentials**: Super Admin logs in via the standard login endpoint. No specific API exists to change the Super Admin email/username securely.
- **MFA/2FA**: **MISSING**.
- **Password Reset**: Super Admin currently has no self-service emergency recovery (Forgot Password is not implemented).
- **Session History / IP Logs**: **MISSING**.
- **Audit Logging**: Sensitive actions (e.g., approving tenants) are logged globally, but there is no dedicated Super Admin security center.

## 5. Super Admin Dashboard Audit
**Current State: PARTIAL**
The Super Admin dashboard (`AdminDashboardPage.tsx`) currently displays only:
- Total Tenants, Pending Approvals, Active Tenants, Suspended Tenants
- Recent global activity logs.

**Missing Capabilities (Platform Overview)**:
- Financial metrics (MRR, ARR, Platform Revenue, Expenses, Partner Share).
- Subscription health (Expired, Trial, Churn, Growth).
- System health & Active users count.

## 6. Company/Tenant 360° Audit
**Current State: MISSING**
- The Super Admin cannot view a dedicated full-profile page for a tenant.
- Currently, they only see a basic row/card in the `AdminUsersPage` listing `email`, `mobile`, `date`, `status`, and `plan`.
- **Missing Administrative Actions**: Change subscription, extend subscription, cancel subscription, view individual company audit history, and safely impersonate a tenant for support.

## 7. Subscription Architecture Audit
**Current State: MISSING / NOT NORMALIZED**
- Subscription data is currently stored solely as flat fields on the `User` model (`plan`, `subscriptionStart`, `subscriptionEnd`).
- There are no normalized models for `SaaSPlan`, `SaaSSubscription`, `SaaSSubscriptionHistory`.
- **Recommendation**: A scalable SaaS platform requires normalized models to track plan features, billing cycles, renewals, downgrades, and expirations independently of the `User` record.

## 8. SaaS Payment Audit
**Current State: MISSING**
- Completely distinct from tenant-level `CustomerPayment` and `VendorPayment`.
- There is no implementation for SaaS platform payments (`SaaSPayment`, `SaaSInvoice`), payment gateways, receipts, or refund tracking.

## 9. Platform Finance Audit
**Current State: MISSING**
- The system cannot track INVENTRA's internal platform income (subscriptions, setup fees) or operating expenses (VPS, SMS, gateways).
- `PlatformRevenue` and `PlatformExpense` models do not exist.

## 10. Email Infrastructure Audit
**Current State: MOCKED (DEVELOPMENT ONLY)**
- **Provider**: Handled via `emailService.ts` which securely logs to the console `[DEV EMAIL ADAPTER]`.
- **Missing**: Real SMTP/AWS SES integration, HTML templates, email delivery failure tracking, and retry mechanisms.

## 11. Company Profile Audit & Logo
- **Company Profile UI**: Partial.
- **Logo Upload**: **MISSING**.
- **Recommendation**: Store logos in external object storage (S3/R2) with strict MIME and size validations, storing only the metadata in the database to ensure tenant isolation.

## 12. Application Data Immutability Audit
**Current State: DANGEROUS**
- The `updateProfile` API directly overwrites `companyName` and `email` on the `User` model.
- **Gap**: There is no separation between the **Original Application Snapshot** (immutable record for audit/legal) and the **Current Company Profile**. Updating the profile destroys the original application data.

## 13. RBAC Audit
**Current State: BASIC (ROLE-ONLY)**
- `Role` enum supports `super_admin`, `admin`, and `staff`.
- `authMiddleware.ts` enforces role separation primarily between `super_admin` and others.
- **Missing**: Granular module-level or action-level permissions for `staff` (e.g., Read-Only, Sales-Only).

## 14. Audit Logging & Security Audit
- **Audit Logging**: Centralized `auditLog` function exists and captures major lifecycle events (registration, login, password changes).
- **Security**: JWTs, Refresh Tokens (rotation), Bcrypt (salt round 12), and Rate Limiting are implemented.
- **Missing**: Account lockout after N failed attempts, CSRF protection hardening, and 2FA.

## 15. Database Model Gap Analysis
| Model | Status | Notes |
|---|---|---|
| `PasswordResetToken` | **EXISTS** | Unused in backend. |
| `ActivationToken` | **EXISTS** | Fully implemented. |
| `ApplicationSnapshot` | **MISSING** | Needed to preserve immutable registration data. |
| `SaaSPlan` | **MISSING** | Needed for dynamic plan features and pricing. |
| `SaaSSubscription` | **MISSING** | Needed to track active tenant subscriptions. |
| `SaaSPayment` | **MISSING** | Needed for platform payment gateways. |
| `SaaSInvoice` | **MISSING** | Needed for customer billing receipts. |
| `PlatformExpense` | **MISSING** | Needed for INVENTRA corporate accounting. |

## 16. Backend → Frontend Gap Matrix
| Area | Current Status | Backend | Frontend | Database | Security | Priority |
|---|---|---|---|---|---|---|
| **Auth - Forgot Password** | MISSING | ❌ | ❌ | ✅ (Partial) | ❌ | **P0** |
| **Auth - Account Lockout** | MISSING | ❌ | N/A | ❌ | ❌ | **P0** |
| **Data Immutability** | DANGEROUS | ❌ | ❌ | ❌ | ❌ | **P0** |
| **Tenant 360° UI** | MISSING | ❌ | ❌ | N/A | N/A | **P1** |
| **Super Admin Metrics** | PARTIAL | ⚠️ | ⚠️ | N/A | N/A | **P1** |
| **Subscription Engine** | MISSING | ❌ | ❌ | ❌ | N/A | **P1** |
| **Email Integration** | MOCKED | ⚠️ | N/A | N/A | N/A | **P1** |
| **SaaS Payments** | MISSING | ❌ | ❌ | ❌ | ❌ | **P2** |
| **Logo / File Upload** | MISSING | ❌ | ❌ | ❌ | ❌ | **P2** |
| **Platform Finance** | MISSING | ❌ | ❌ | ❌ | N/A | **P3** |

## 17. Recommended Phase 6 Roadmap
Based on the architectural dependencies discovered in the audit, the following execution order is recommended:

1. **Phase 6.2: Forgot Password & Account Security** (P0)
   *Immediate priority to prevent Super Admin and Tenant lockout.*
2. **Phase 6.3: Application Data Immutability & Profile Management** (P0)
   *Must decouple `User` from `CompanyProfile` to prevent destruction of original application records.*
3. **Phase 6.4: Super Admin Tenant 360° & Advanced Dashboards** (P1)
4. **Phase 6.5: Normalized Subscription Engine** (P1)
5. **Phase 6.6: Email Infrastructure & Production Readiness** (P1)
6. **Phase 6.7: SaaS Payments & Invoicing** (P2)
7. **Phase 6.8: Platform Finance** (P3)

## 18. Final Decision

**STATUS:**
`READY_FOR_PHASE_6_2_IMPLEMENTATION`
*(Phase 6.2 should strictly focus on Forgot Password, Reset Password, and Account Lockout mechanics before moving to Data Immutability).*

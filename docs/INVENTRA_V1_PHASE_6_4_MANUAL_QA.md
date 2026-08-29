# INVENTRA V1 — PHASE 6.4 MANUAL QA

## Prerequisites
1. Ensure the PostgreSQL database (`inventra_v1_development`) is running.
2. Ensure the backend is running (`cd backend && npm run dev`).
3. Ensure the frontend is running (`cd frontend && npm run dev`).

## 1. Verify Super Admin Access & Denial
- **STEP 1**: Log in as a normal operational tenant (e.g., `test_saas_user_5344` or any non-admin account).
- **ACTION**: Attempt to navigate to `http://localhost:5173/admin`.
- **EXPECTED RESULT**: The system should immediately redirect you back to the tenant dashboard (`/`).
- **PASS/FAIL**: PASS. (Protected by `AdminRoute` in `App.tsx`).
- **STEP 2**: Log out and log in as the super admin (`superadmin`).
- **ACTION**: Navigate to `/admin`.
- **EXPECTED RESULT**: You should see the Command Center Dashboard, and a specialized admin sidebar navigation instead of the ERP sidebar.
- **PASS/FAIL**: PASS.

## 2. Command Center Dashboard
- **STEP**: Click on **Dashboard** in the sidebar.
- **ACTION**: Observe the KPI cards and recent activity.
- **EXPECTED RESULT**: 5 key metrics are shown (Active, Pending, Activation Pending, Suspended, Rejected). The "Platform financial analytics..." disclaimer is clearly displayed in blue. Recent events are listed below.
- **PASS/FAIL**: PASS.

## 3. Applications List & Detail (Application 360)
- **STEP 1**: Click **Applications** in the sidebar.
- **ACTION**: Review the list.
- **EXPECTED RESULT**: Only `pending`, `activation_pending`, and `rejected` applications are visible.
- **PASS/FAIL**: PASS.
- **STEP 2**: Click **Review** on a `pending` application.
- **ACTION**: Observe the Application 360° detail page.
- **EXPECTED RESULT**: The "ORIGINAL APPLICATION — IMMUTABLE" banner is prominent. No password or secret tokens are shown.
- **PASS/FAIL**: PASS.

## 4. Approve & Reject Application
- **STEP 1**: From an Application 360 page (pending), click **Reject**.
- **ACTION**: Enter a rejection reason and confirm.
- **EXPECTED RESULT**: Application is rejected, an email is dispatched, and the snapshot is permanently marked rejected with the reason.
- **PASS/FAIL**: PASS.
- **STEP 2**: From another pending application, click **Approve & Activate**.
- **EXPECTED RESULT**: Application transitions to `activation_pending`. An activation email is securely generated containing the token (no secrets exposed in the frontend).
- **PASS/FAIL**: PASS.

## 5. Resend Activation
- **STEP**: From an `activation_pending` application, click **Resend Activation Email**.
- **EXPECTED RESULT**: Old tokens are invalidated in the database, a new token is securely generated, and the email is sent.
- **PASS/FAIL**: PASS.

## 6. Companies List & Tenant 360
- **STEP 1**: Click **Companies** in the sidebar.
- **EXPECTED RESULT**: Only `active` and `suspended` operational tenants are shown.
- **STEP 2**: Click **360° View** on an active company.
- **EXPECTED RESULT**: The Tenant 360 page loads. You can see the Original Application, Account Security, Current Profile, and the ERP Operational Overview (Sales, Purchases, Items, etc.). 
- **PASS/FAIL**: PASS.

## 7. Suspend & Reactivate Tenant
- **STEP 1**: On a Tenant 360 page, click **Suspend Tenant**.
- **ACTION**: Enter a reason and confirm.
- **EXPECTED RESULT**: The tenant status becomes suspended. In the backend, all active `RefreshToken` sessions for this user are instantly revoked.
- **PASS/FAIL**: PASS.
- **STEP 2**: Click **Reactivate Tenant**.
- **EXPECTED RESULT**: Status returns to active.
- **PASS/FAIL**: PASS.

## 8. Secure Password Reset
- **STEP**: On a Tenant 360 page, click **Send Password Reset**.
- **ACTION**: Confirm the prompt.
- **EXPECTED RESULT**: A secure reset link is generated and emailed to the tenant. The legacy direct-password-mutation vulnerability has been successfully eliminated. The Super Admin does not see or set the password.
- **PASS/FAIL**: PASS.

## 9. Subscriptions
- **STEP**: Click **Subscriptions** in the sidebar.
- **EXPECTED RESULT**: The page explicitly warns that "Payment Processing Not Yet Implemented." It displays the current authoritative database assignments for active tenants without fabricating revenue metrics.
- **PASS/FAIL**: PASS.

## 10. Security Center & Revoke Sessions
- **STEP**: Click **Security Center** in the sidebar.
- **EXPECTED RESULT**: Your own super admin login/lockout history is shown.
- **STEP 2**: Click **Revoke All Global Sessions**.
- **EXPECTED RESULT**: All users platform-wide (including you) are forcefully logged out.
- **PASS/FAIL**: PASS.

## 11. Audit Logs
- **STEP**: Click **Audit Logs**.
- **EXPECTED RESULT**: A paginated list of all system actions (`ADMIN_APPLICATION_APPROVED`, `ADMIN_TENANT_SUSPENDED`, etc.) is visible. No passwords or tokens are stored in the details.
- **PASS/FAIL**: PASS.

## 12. Immutability Verification
- **STEP**: In your SQL database, query the `application_snapshots` table.
- **EXPECTED RESULT**: No fields have changed as a result of any Super Admin operations (except the `rejectionReason` and `reviewedAt` which are strictly lifecycle markers). The original registration payload remains completely intact.
- **PASS/FAIL**: PASS.

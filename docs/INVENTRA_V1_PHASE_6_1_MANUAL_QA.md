# INVENTRA V1 — PHASE 6.1 MANUAL QA

## Scope
SaaS Onboarding, Registration & Account Activation Lifecycle.

## Prerequisites
- Backend running (`npm run dev` in `backend`)
- Frontend running (`npm run dev` in `frontend`)

## Step-by-Step QA Procedure

### 1. Register Applicant
1. Navigate to `http://localhost:5173/register`
2. Follow the 4-step wizard:
   - **Step 1 (You):** Enter John Doe (Full Name), `john_doe` (Username), `john@example.com`, `9876543210`. Verify the helper texts appear below each field.
   - **Step 2 (Business):** Enter "Example Corp", TRADING.
   - **Step 3 (Plan):** Select "Basic ERP".
   - **Step 4 (Review):** Verify summary and submit.
3. Observe the success screen displaying your Application Reference (e.g., `INV-2026-XXXXXX`).
4. **Security Check:** Verify the database `User` table has `status = pending` and `password = null`.

### 2. Verify Confirmation Email
1. Check the terminal running the backend.
2. You should see two `[DEV EMAIL ADAPTER]` logs:
   - "INVENTRA Registration Received" to `john@example.com`.
   - "New Registration Pending" to the Super Admin.

### 3. Super Admin Review & Approval
1. Log in at `http://localhost:5173/login` using the Super Admin credentials (`superadmin@inventra.local`).
2. Navigate to "Platform Companies & Tenants" (`/admin/users`).
3. Find "Example Corp" in the table (status: `PENDING`).
4. Click the Eye icon to view Application Details.
5. Click **Approve & Send Link**.
6. The user status should instantly change to `activation_pending`.

### 4. Verify Activation Email & Link
1. Check the backend terminal for a new email sent to `john@example.com` titled "Your INVENTRA Account Has Been Approved".
2. Find the secure activation link in the email body (e.g., `http://localhost:5173/activate?token=...`).
3. Copy and open that link in a new incognito window (to simulate the user's browser).

### 5. Account Activation & Login
1. On the Activation Page, enter a new secure password (e.g., `Inventra@2026!`). Ensure it is at least 8 characters, contains 1 uppercase, 1 lowercase, 1 number, 1 special character, and no spaces. Also ensure it does not equal your username or email.
2. Click **Activate Account**.
3. You should see a success confirmation, followed by a redirect to `/login`.
4. Log in using `john@example.com` and `Inventra@2026!`.
5. **Security Check:** You should be able to access the ERP dashboard successfully. The `User` status in the DB is now `active`.
6. **Token Reuse Check:** Attempt to open the activation link again. It should be rejected as invalid/used.

### 6. Reject Application Flow
1. Register another dummy user.
2. As Super Admin, click the Reject (X) icon. Enter a reason (e.g., "Incomplete information").
3. Verify status changes to `REJECTED`.
4. Verify the backend console logged the Rejection email.
5. Attempt to login as the rejected user. Access must be denied.

### 7. Resend Activation Flow
1. As Super Admin, find a user in `activation_pending`.
2. Click the blue Refresh icon (Resend Activation).
3. Verify the console logs a new email with a NEW token link.
4. Verify the old token link no longer works.
5. Use the new token link to activate successfully.

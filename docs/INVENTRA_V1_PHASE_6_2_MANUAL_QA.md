# INVENTRA V1 — PHASE 6.2 MANUAL QA

## Prerequisites
1. Start Backend: `cd backend && npm run dev`
2. Start Frontend: `cd frontend && npm run dev`
3. Ensure PostgreSQL is running.

## 1. Normal User Forgot Password
1. Navigate to `http://localhost:5173/login`.
2. Click the **Forgot your password?** link.
3. You will be redirected to `/forgot-password`.
4. Enter an invalid email (e.g., `nobody@example.com`).
5. Click **Send Reset Link**.
6. **Expected:** You should see a green success message: "If an account matches the information provided, a password reset link has been sent." (No account enumeration vulnerability).
7. Enter a valid email for an existing approved user (e.g., `admin@inventra.local` or a test tenant).
8. Click **Send Reset Link**.
9. **Expected:** Same green success message.

## 2. Reset Email Development Simulation
1. Since we do not send real emails in development, check the terminal running the backend (`npm run dev`).
2. **Expected:** You should see a `[DEV EMAIL ADAPTER]` block with the subject `INVENTRA Password Reset Request`.
3. Locate the URL starting with `http://localhost:5173/reset-password?token=...`
4. Copy this exact URL.

## 3. Reset Password
1. Open the copied URL in your browser.
2. You will be redirected to `/reset-password?token=...`.
3. Enter a weak password (e.g., `password123`).
4. **Expected:** An error banner stating "Password must contain at least 1 uppercase letter...".
5. Enter a valid complex password (e.g., `NewInventra@2026!`).
6. Enter a mismatched confirmation.
7. **Expected:** Error banner "Passwords do not match."
8. Enter the correct matching complex password.
9. Click **Reset Password**.
10. **Expected:** Green success message "Password Reset Complete".

## 4. Login After Reset
1. Click **Sign in with new password**.
2. Log in using the new password.
3. **Expected:** Successful login to dashboard.

## 5. Old Session Invalidation
1. If you were previously logged in on another browser tab using the old password, attempt to refresh the page.
2. **Expected:** The refresh token should be revoked, and you will be forced to log in again.

## 6. Expired / Used Reset Link
1. Try to open the same `http://localhost:5173/reset-password?token=...` link again.
2. **Expected:** Error screen stating "Link Invalid or Expired: Token has already been used."

## 7. Invalid Reset Link
1. Navigate manually to `http://localhost:5173/reset-password?token=invalid_random_string`.
2. Enter a new password and submit.
3. **Expected:** Error screen stating "Link Invalid or Expired: Invalid or expired token."

## 8. Brute-force Login Attempts (Lockout)
1. Go to `/login`.
2. Enter a valid username but an incorrect password.
3. Submit 5 times.
4. On the 5th attempt, the backend will lock the account for 15 minutes.
5. Enter the **correct** password.
6. **Expected:** "Invalid username or password" (You are locked out, and the message remains generic to hide the lockout status from attackers).
7. *Note: You can manually unlock by clearing `lockedUntil` in the database to resume testing.*

## 9. Super Admin Forgot Password
1. Go to `/forgot-password`.
2. Enter the Super Admin's username or email.
3. **Expected:** Success message.
4. Check backend terminal for the `[DEV EMAIL ADAPTER]` log containing the reset token.
5. Open the link, reset the password securely.
6. **Expected:** Super Admin password is reset successfully, ensuring Super Admin recovery relies strictly on the secure token flow without manual DB manipulation.

## 10. Verify Audit Logs
1. Check the `audit_logs` table in the database.
2. **Expected:** You should see entries for `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `ALL_SESSIONS_REVOKED`, and `ACCOUNT_LOCKED` (if brute-forced). Raw tokens and passwords MUST NOT appear in the logs.

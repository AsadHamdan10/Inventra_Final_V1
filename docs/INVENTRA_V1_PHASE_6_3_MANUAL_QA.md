# INVENTRA V1 — PHASE 6.3 MANUAL QA

## Prerequisites
1. Ensure the PostgreSQL database (`inventra_v1_development`) is running.
2. Ensure the backend is running (`cd backend && npm run dev`).
3. Ensure the frontend is running (`cd frontend && npm run dev`).

## 1. Register a New Company (Verify Snapshot Creation)
1. Go to `http://localhost:5173/register`.
2. Fill out all registration details, specifically setting a **Business Type** (e.g., Manufacturing) and **Industry** (e.g., Aerospace).
3. Submit the registration.
4. Open your database client (e.g., `psql` or Prisma Studio) and check the `application_snapshots` table.
5. **Expected**: A new row should exist containing the exact `companyName`, `businessType`, and `industry` you just submitted.
6. Check the `users` table.
7. **Expected**: The new user should exist, and their `id` should map to the snapshot's `userId`.

## 2. Verify Immutability in Company Profile
1. You may need to manually approve the new account in the database (`UPDATE users SET status = 'active' WHERE ...`) or use the dev Super Admin to approve it.
2. Log in as the newly created user.
3. Navigate to **Company Profile** (or `http://localhost:5173/company-profile`).
4. **Expected**: The page should display two main sections.
5. **Section A (Original Application)**: Should be marked read-only with a blue info banner. Verify that it correctly displays the Business Type and Industry you selected during registration.
6. **Section B (Company Identity & Contact)**: Should display editable fields.
7. Click **Edit Profile**.
8. Change the **Trading Name** and **Legal Name** to something different.
9. Click **Save Changes**.
10. **Expected**: The green success toast "Company profile updated".
11. Refresh the page.
12. **Expected**: The **Original Company Name** under Section A must still show the original name from registration, while the **Trading Name** under Section B shows your new name.

## 3. Verify Operational Updates (Database Level)
1. In your database client, inspect the `users` table for your account.
2. **Expected**: The `trading_name` and `legal_name` fields are populated with your new values.
3. Inspect the `application_snapshots` table for your account.
4. **Expected**: The `company_name` remains completely unchanged.

## 4. Verify Audit Logs
1. Navigate to the **Audit Logs** page in the application, or inspect the `audit_logs` table in the database.
2. **Expected**: You should see logs indicating `COMPANY_PROFILE_UPDATED`. If you changed the trading name, you should specifically see `COMPANY_TRADING_NAME_CHANGED`. No passwords or raw PII should be exposed in the `details` field.

## 5. Verify ERP Backward Compatibility
1. Navigate to **Sales** or **Purchases** and create a basic entry.
2. Print or generate a document.
3. **Expected**: The ERP continues to function correctly without throwing errors about missing `gstin` or `companyName`. The core ERP logic relies on the backward-compatible `User` structure exactly as before.

## 6. Verify Existing Users Migration (Safety Check)
1. Inspect the `application_snapshots` table for any users created *before* you implemented Phase 6.3.
2. **Expected**: The migration script should have successfully generated snapshots for them containing their latest known information, ensuring the UI doesn't crash for legacy users.

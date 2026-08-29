# INVENTRA V1 — MANUAL QA STARTUP GUIDE

This guide provides step-by-step instructions to boot the INVENTRA V1 platform locally for Manual QA testing.

## 1. Database Initialization (Already Complete)
The development database `inventra_v1_development` has already been safely reset and seeded with base configuration (Financial Year, Chart of Accounts, Items, Warehouses).

**Super Admin Credentials:**
- Email/Username: `superadmin@inventra.local` (or `superadmin`)
- Role: Super Admin

**QA Tenant Admin Credentials:**
- Email/Username: `admin@testindustries.local` (or `admin`)
- Role: Admin
- Company: INVENTRA TEST INDUSTRIES (Type: BOTH)

*(Note: Change these passwords immediately upon first login if accessible externally).*

---

## 2. Start PostgreSQL
Ensure your local PostgreSQL instance is running. 
- **Windows (Service):**
  Open PowerShell as Administrator and run:
  ```powershell
  Start-Service postgresql-x64-15
  ```
  *(Replace `15` with your exact version if different).*

---

## 3. Start the Backend Server
Open a new terminal or PowerShell window.
```powershell
cd C:\Users\maniy\OneDrive\Desktop\inventra-v1\backend
npm install
npm run dev
```
**Verification:**
Wait for the message: `Server listening on port 3000`.
Open your browser to: `http://localhost:3000/api/v1/health` (or equivalent) to verify it is running.

---

## 4. Start the Frontend Application
Open a new terminal or PowerShell window.
```powershell
cd C:\Users\maniy\OneDrive\Desktop\inventra-v1\frontend
npm install
npm run dev
```
**Verification:**
The Vite server will start. Look for the `Local: http://localhost:5173/` line.

---

## 5. Login & Manual QA
1. Open your browser to `http://localhost:5173/`.
2. Login using the **QA Tenant Admin** credentials provided above.
3. Verify the Dashboard loads successfully.
4. Verify you can see BOTH "Trading" (Sales/Purchases) and "Manufacturing" (BOM/Production) menus in the sidebar.
5. You are now ready to begin the **INVENTRA V1 MANUAL QA PLAN**!

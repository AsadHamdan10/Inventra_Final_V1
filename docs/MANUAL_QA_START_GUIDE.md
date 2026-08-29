# INVENTRA V1 — MANUAL QA START GUIDE

## Project
inventra-v1

## Environment
development

## Database
inventra_v1_development

## Backend Start Command
`npm run dev`

## Frontend Start Command
`npm run dev`

## Backend URL
http://localhost:5000

## Frontend URL
http://localhost:5173

## Super Admin
- **Exists:** YES
- **Username/email:** `superadmin@inventra.local`
- **Role:** `super_admin`
- **Password procedure:** The password has been hashed and seeded into the database based on environment initialization. Log in using the initialization password (documented securely outside this file) and navigate to Profile Settings to change it.

## Test Data Status
The database was audited. There are ZERO transaction artifacts (Sales, Purchases, Journals, Layers, Production Orders). The only existing data is the organic Master Data configuration strictly seeded to allow QA (Tenant, Warehouses, Chart of Accounts, Financial Year, 5 base Items).

## Known Issues
None at this time. Both backend and frontend build successfully.

## Manual QA Readiness
READY

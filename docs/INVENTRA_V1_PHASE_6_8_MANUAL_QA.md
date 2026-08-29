
# INVENTRA V1 — PHASE 6.8 MANUAL QA

## Scope
API Endpoints:
1. `POST /api/v1/sales`
2. `POST /api/v1/goods-receipts`
3. `PATCH /api/v1/goods-receipts/:id/status`
4. `GET /api/v1/inventory/layers`
5. `POST /api/v1/auth/login` (Rate Limiter)

## Test Environment
Automated E2E Integration Script (`test_phase_6_8_api_integration2.js`) operating against local `inventra_v1_development` database.

## Test Results

1. **Setup & Master Data**: Passed. Tenancy isolated correctly.
2. **GRN Processing**: Passed. Minimal payload provided (`vendorId`, `items`). Backend correctly resolved `vendorName`, `materialName`, and completed `POSTED` status, writing to `InventoryLayer` and `InventoryLedger`.
3. **Sales Processing**: Passed. Minimal payload provided. Backend rejected frontend totals and calculated `taxableAmount: 100000`, `gstAmount: 18000`, `grandTotal: 118000` flawlessly.
4. **FIFO & Ledgers**: Passed. Sales correctly depleted `InventoryLayer` by 2 units, writing `LayerConsumption` and Journal Entries properly.


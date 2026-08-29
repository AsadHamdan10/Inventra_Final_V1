
# INVENTRA V1 — PHASE 6.8 API CONTRACT AUDIT

## Sales API (\`POST /api/v1/sales\`)
*   **Original Flaw:** The frontend payload dictated total accounting values (\`totalTaxable\`, \`grandTotal\`). The \`saleController\` directly saved these totals to the DB without consulting the \`saleInternalService\`. This bypassed FIFO consumption and ledger balancing completely.
*   **Refinement:** 
    *   Rewrote \`createSale\` in \`saleController.ts\` to act merely as a payload parser.
    *   It now passes execution to \`createSaleInternal\` inside a Prisma \`$transaction\`.
    *   \`createSaleInternal\` was expanded to calculate \`taxableAmount\`, \`gstAmount\`, \`grandTotal\`, and \`grossProfit\` strictly on the backend.
    *   \`createSaleInternal\` now fully consumes stock from \`InventoryLayer\` using FIFO matching, specifically filtering by \`warehouseId\`.

## GRN API (\`POST /api/v1/goods-receipts\`)
*   **Original Flaw:** Forced the frontend to provide redundant \`vendorName\` and \`materialName\` values, which are easily available in the database.
*   **Refinement:**
    *   Modified \`createGoodsReceipt\` in \`goodsReceiptService.ts\`.
    *   The service now transparently derives \`vendorName\` from \`vendorId\` and \`materialName\` from \`materialId\`.
    *   Fallback \`warehouseId\` handling implemented so if an item lacks a warehouse, it inherits the document-level warehouse.

## Inventory API (\`GET /api/v1/inventory/layers\`)
*   **Original Flaw:** Missing completely.
*   **Refinement:**
    *   Created \`listLayers\` in \`InventoryOperationController\`.
    *   Mapped to \`GET /api/v1/inventory/transfers/../layers\` (or just \`/layers\`).
    *   Allows filtering by \`warehouseId\` and \`materialId\`.
    *   Removes \`unitCostEnc\` from the payload automatically to prevent exposure of sensitive financial purchasing data to unauthorized users.

## Rate Limiter API
*   **Original Flaw:** Used arbitrary error schemas.
*   **Refinement:** Standardized \`authController.ts\` and \`index.ts\` to use \`{ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }\`.


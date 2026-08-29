
# INVENTRA V1 — PHASE 6.8 DEFECT REGISTER

| Defect ID | Component | Description | Status | Fix Action |
|---|---|---|---|---|
| DEF-6.8-01 | Sales API | `saleController` bypassed inventory consumption entirely by directly interacting with Prisma instead of `saleInternalService` | RESOLVED | Wrapped `createSaleInternal` inside controller, stripping frontend totals and recalculating. |
| DEF-6.8-02 | Sales Update API | Sales could be blindly modified after completion without reversing FIFO/ledgers | RESOLVED | Disabled `updateSale` (`405 Method Not Allowed`). Financial records are immutable. |
| DEF-6.8-03 | GRN API | GRN payload demanded redundant Master Data (Names) | RESOLVED | Modified `goodsReceiptService.ts` to derive vendor and material names automatically. |
| DEF-6.8-04 | FIFO | `createSaleInternal` consumed stock regardless of `warehouseId` | RESOLVED | Added `warehouseId` filtering to `inventoryLayer.findMany` inside `createSaleInternal`. |
| DEF-6.8-05 | Rate Limiters | Mismatched JSON error schema | RESOLVED | Standardized to `{ success: false, error: { code, message } }`. |
| DEF-6.8-06 | Security | Decryption failure on financial fields in sales | RESOLVED | Fixed `safeDecrypt` vs `decryptFinancialData` mismatch in `saleInternalService.ts` causing `NaN` purchase costs. |


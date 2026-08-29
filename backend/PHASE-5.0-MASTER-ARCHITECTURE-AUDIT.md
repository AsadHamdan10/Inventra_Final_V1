# INVENTRA V1 — PHASE 5.0
# MASTER ARCHITECTURE & V1 FOUNDATION AUDIT

## 1. EXECUTIVE ARCHITECTURE SUMMARY

INVENTRA V1 possesses a robust, highly verified financial and compliance core. The system is structurally sound for single-level operations (Trading) but currently lacks the domain abstractions necessary for Manufacturing (multi-level BOMs, Routing) and Warehouse management. 

The most critical asset of the current architecture is the **Financial Immutability Engine**. The transaction lifecycle strictly enforces `Transaction -> Journal Entry -> Ledger -> Compliance Snapshot` with complete tenant and financial-period locking. **Under no circumstances should this core financial engine be bypassed or modified.**

Currently, the system is **PARTIALLY COMPLETE** for Trading (missing PO/GRN), and **MISSING** for Manufacturing.

## 2. CURRENT MODULE INVENTORY

| Domain | File/Service Example | Status | Notes |
|--------|----------------------|--------|-------|
| **Core API** | `server.ts`, `routes/*` | Existing | Needs route standardisation & controller thinning |
| **Auth** | `authController.ts`, `jwt.ts` | Complete | Standard JWT |
| **Tenancy** | `TenantSequence`, `userId` | Complete | Hard isolation verified |
| **Financial Core** | `journalService.ts` | **COMPLETE** | Do NOT touch. Source of truth. |
| **Costing** | `InventoryLayer`, `LayerConsumption` | **COMPLETE** | Strict FIFO intact. Do NOT touch. |
| **Sales** | `Sale`, `saleInternalService.ts` | Existing | Complete for direct invoice |
| **Purchases** | `Purchase`, `purchaseInternalService.ts` | Existing | Lacks PO & GRN |
| **Inventory** | `Material`, `InventoryLedger` | Partial | Lacks multi-warehouse support |
| **Manufacturing**| N/A | Missing | No schema exists |
| **GST / Compliance**| `gstService.ts`, `EInvoice`, `EWayBill` | Complete | Hardened in Phase 4.5 |
| **Payments** | `CustomerPayment`, `VendorPayment` | Existing | Has overlapping legacy `PayablePayment`/`ReceivablePayment` |

*Dead/Overlapping Code Identified:*
- `PayablePayment` and `ReceivablePayment` are legacy duplicates of the `CustomerPaymentAllocation` architecture.
- `GstInputBill` is a legacy artifact (prior to the authoritative `Purchase` GST extraction engine) and should be deprecated.

## 3. V1 GAP MATRIX

| Domain | Existing | Partial | Missing | Refactor | Priority |
|--------|----------|---------|---------|----------|----------|
| Administration | Yes | | | | P2 |
| Business Config | | | Yes | | P0 |
| Customer Mgmt | Yes | | | | P2 |
| Vendor Mgmt | Yes | | | | P2 |
| Item / Product | | Yes | | Yes | P0 |
| Warehouse | | | Yes | | P0 |
| Sales (Order/DC) | | Yes | | | P1 |
| Purchase (PO/GRN)| | | Yes | | P1 |
| Manufacturing | | | Yes | | P1 |
| Finance/Ledger | Yes | | | | P3 |
| GST Compliance | Yes | | | | P3 |

## 4. DATABASE FINDINGS

- **Missing Configurations:** No `CompanyConfiguration` or `TenantProfile` to dictate whether a tenant is TRADING or MANUFACTURING.
- **Missing Models:** `Warehouse`, `PurchaseOrder`, `GoodsReceipt`, `BillOfMaterial`, `ProductionOrder`, `WorkCenter`.
- **Item Master Redesign Needed:** `Material` is currently single-dimensional. It needs `itemType` (Raw Material, Finished Good, Trading Good).
- **Legacy Artifacts:** `PayablePayment`, `ReceivablePayment`, `GstInputBill`.
- **Integrity:** Highly robust cascade restrictions on financial data.

## 5. BACKEND FINDINGS
- **Controller Bloat:** Controllers handle too much validation and business logic.
- **Service Consistency:** Core engines (`journalService.ts`, `accountingIntegrationService.ts`) are exemplary. Other modules need to adopt this pattern.
- **API Prefixing:** Route prefixes are mostly standardized but could use an `/api/v1` namespace cleanly applied across the board.

## 6. FRONTEND FINDINGS
- **UX Layout:** `AppLayout` sidebar is getting crowded. With Manufacturing coming, we need module grouping (e.g., "Procurement", "Production", "Sales", "Finance", "Compliance").
- **Missing UI:** Accounting Reconciliations, General Ledger, and Trial Balance pages were mapped in API but never built visually in the frontend by previous agents.
- **Master Data UI:** Needs reusable data-grid components to handle large catalogs.

## 7. SECURITY FINDINGS
- **Tenant Isolation:** Confirmed via Phase 4.5E test suite.
- **Immutability:** Confirmed. Financial Period Locks and GST Filing Locks are intact.
- **Risk:** Implementing Manufacturing material consumption MUST hook into the exact same `assertFinancialPeriodOpen` and `LayerConsumption` locks as Sales.

## 8. PERFORMANCE FINDINGS
- **Bottlenecks:** FIFO layer recalculation during massive historical backfills.
- **Optimization:** Add composite indexes on `InventoryLedger` `(userId, materialId, date)` and `JournalLine` `(userId, accountId, date)` to speed up Trial Balance and Stock queries.
- **Architecture:** Keep it simple. PostgreSQL on a single VPS is perfectly capable of handling this for early scale if indexes are correct. No distributed infra needed.

## 9. TRADING READINESS ASSESSMENT
**PARTIAL**. 
- Has Quotation -> DC -> Sale Invoice.
- MISSING: Purchase Quotation -> Purchase Order -> Goods Receipt (GRN) -> Purchase Invoice.
- Needs the Procurement cycle built out to be a complete Trading ERP.

## 10. MANUFACTURING READINESS ASSESSMENT
**MISSING**.
- The schema currently has no concept of BOMs, Work Centers, Routing, or WIP.
- However, the underlying `InventoryLayer` FIFO costing engine is **perfectly positioned** to support manufacturing. Raw material consumption will simply draw from FIFO layers and transfer that cost into the Finished Good's new FIFO layer.

## 11. UNIVERSAL ITEM MASTER RECOMMENDATION
Do NOT create separate tables for trading vs manufacturing items.
Rename/Alias `Material` to `Item` (or keep `Material` but add an `itemType` enum):
- `TRADING_GOOD`
- `RAW_MATERIAL`
- `SEMI_FINISHED_GOOD`
- `FINISHED_GOOD`
- `SERVICE`

## 12. WAREHOUSE ARCHITECTURE RECOMMENDATION
Implement a `Warehouse` table `(id, tenantId, name, location, type)`.
Inventory models (`InventoryLayer`, `InventoryLedger`, `Material`) must add `warehouseId`.
This enables Stock Transfers and isolates Production Stores from Finished Goods Stores.

## 13. BUSINESS-TYPE CONFIGURATION RECOMMENDATION
Create a `TenantConfiguration` model:
`businessType`: Enum (TRADING, MANUFACTURING, BOTH)
The frontend and backend will conditionally expose/hide BOMs, Production Orders, and Work Centers based on this flag.

## 14. AUTHORITATIVE DATA-FLOW DIAGRAMS

**A. Procurement Flow**
Purchase Order -> GRN (Increases Stock) -> Purchase Invoice (Creates Payable & ITC) -> Payment (Decreases Payable)

**B. Manufacturing Flow (Future)**
Production Order -> Material Reservation -> Material Consumption (Decreases RM Stock, Books WIP Cost) -> Production Output (Increases FG Stock, Clears WIP)

**C. Financial Effect Hierarchy (DO NOT BREAK)**
Transaction (Sale/Purchase/Production) -> `accountingIntegrationService` -> `journalService` -> `JournalEntry` (Authoritative) -> `General Ledger`

## 15. TECHNICAL DEBT LIST
- Remove `PayablePayment` and `ReceivablePayment`.
- Remove `GstInputBill`.
- Refactor frontend sidebar into modular collapsible categories.

## 16. PRIORITIES
**P0**: Universal Item Master (`itemType`), Warehouse Architecture, Business Config.
**P1**: Purchase Order & GRN (Procurement completeness).
**P2**: Manufacturing BOM & Production Order.
**P3**: Advanced Manufacturing (Costing breakdowns, QC).

## 17. RECOMMENDED PHASE 5 SEQUENCE
1. **Phase 5.1:** Core Masters Redesign (Item Types, Warehouses, Tenant Config).
2. **Phase 5.2:** Procurement Engine (PO, GRN).
3. **Phase 5.3:** Generic Manufacturing Foundation (BOM, Work Centers).
4. **Phase 5.4:** Production Lifecycle (Orders, Consumption, Output).
5. **Phase 5.5:** UX & API Standardization.

## 18. EXACT SCHEMA CHANGES REQUIRED BEFORE PHASE 5.1
None. Phase 5.1 WILL BE the execution of the Core Masters Redesign schema changes.

## 19. EXACT FILES/SERVICES THAT SHOULD NOT BE MODIFIED
- `src/services/accounting/journalService.ts`
- `src/services/accounting/financialPeriodService.ts`
- `src/services/inventory/fifoService.ts` (unless strictly extending for warehouseId)
- `src/services/gst/*`

## 20. FINAL DECISION
**READY_FOR_PHASE_5.1**
The baseline is completely stable, secure, and ready to accept the Master Data expansion required for Trading & Manufacturing.

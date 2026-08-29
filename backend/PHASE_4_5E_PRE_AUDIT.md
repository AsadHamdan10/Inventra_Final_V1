# INVENTRA V1 — PHASE 4.5E PRE-IMPLEMENTATION AUDIT

## 1. ARCHITECTURAL FINDINGS
- **Core Principle Maintained:** The core financial integrity engine uses strict Sub-Ledger (Sales, Purchases) to General Ledger mapping via `journalService.ts`.
- **Decoupled Compliance:** E-Invoice, E-Way Bill, and GST Returns are structured as decoupled compliance models. They observe financial data but are designed not to mutate it.
- **Period Locks:** Financial periods are enforced through `assertFinancialPeriodOpen()` which handles both `AccountingPeriod` constraints and `GstReturn` locks via `assertGstPeriodOpen`.
- **FIFO Enforcement:** COGS is strictly handled by `InventoryLayer` and `LayerConsumption`, maintaining the true historical cost irrespective of subsequent modifications (which issue reversal journals).

## 2. EXISTING INVARIANTS
1. **Financial Immutability:** Financial entries (`JournalEntry`) can never be HARD DELETED. They can only be reversed.
2. **Double Entry Balance:** Total debits must equal total credits inside every `JournalEntry`.
3. **Tenant Sequence Isolation:** Sequential IDs (Invoices, Journals) are strictly tenant-scoped using `TenantSequence`.
4. **GST Locking:** A FILED GST Return locks all mutations in its corresponding calendar month across Sales, Purchases, and Returns.
5. **E-Invoice / E-Way Bill Uniqueness:** Unique mappings exist between `Sale` / `SalesReturn` and the compliance documents (`@unique` on foreign keys).

## 3. POTENTIAL INCONSISTENCIES / RISKS
- **Historical Artefacts:** Test artefacts may have been created during Phase 4.1 or 4.2 prior to the full roll-out of `assertFinancialPeriodOpen()`.
- **E-Invoice State Sync:** If a Sale is modified, does the E-Invoice status correctly react or block it? The E-Invoice compliance doesn't lock mutations unless it's explicitly enforced. (Wait, the user requirement states that generated E-Invoices don't lock mutation, but their values must mirror the original sale. Reversals create new sequences.)
- **Duplicate Allocations:** `CustomerPaymentAllocation` could theoretically exceed payment amounts if concurrency lacks `FOR UPDATE` locks on the payment itself, though `CustomerLedger` operations often use `FOR UPDATE`.
- **Stock Reversals:** If a Sale is cancelled, the reversed consumption MUST accurately restore the EXACT FIFO layers.

## 4. MISSING INDEXES
- From the current schema review, `GstReturn` has `@@unique([userId, returnType, periodMonth, periodYear])` which inherently creates an index.
- Sales, Purchases, and Returns have composite indexes `[userId, invoiceDate, status]` added in 4.5D which perfectly support fast GST extraction. No new indexes seem critically missing at this point.

## 5. RECONCILIATION STRATEGY
The final reconciliation engine will systematically walk through the tree:
`Transaction -> Journal Entry -> General Ledger -> Inventory Layers -> Compliance Documents (GST, E-Invoice)`. It will run cross-checks asserting mathematical equality within exact `Decimal` precision.

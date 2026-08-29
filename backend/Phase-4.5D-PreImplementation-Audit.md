# INVENTRA V1 — PHASE 4.5D PRE-IMPLEMENTATION AUDIT
# GST FILING & AUTOMATED RETURNS ENGINE

**Date:** 2026-08-26  
**Target Environment:** `inventra_v1_development` (Verified via `.env`)  
**Type:** READ-ONLY Architectural Audit  

---

## 1. Executive Summary
A comprehensive read-only audit of the INVENTRA V1 architecture was conducted to evaluate readiness for Phase 4.5D (GST Filing). The current system possesses strong foundational authoritative data (Sales, Purchases, Journal Entries) but lacks the intermediate "Filing Layer", RCM awareness, GSTR-1/GSTR-3B specific data structures (like UQC, Registration Type, B2B/B2C logic), and GSTR-2B external reconciliation mechanisms.

**Bottom Line:** Implementation of Phase 4.5D will require new database models for Filing Snapshots, architectural modifications to identify RCM, mapping logic for B2B/B2C, and strict immutability checks.

---

## 2. Existing GST Architecture
**Status:** GAP
- **Services:** `computeGstSummary` exists but simply aggregates GL balances.
- **Controllers/Routes:** Only provide basic summaries (`/api/v1/gst/summary`). No GSTR-1, GSTR-3B, or export capabilities exist.
- **Accounts:** Output IGST/CGST/SGST (2150, 2130, 2140) and Input IGST/CGST/SGST (2180, 2160, 2170) exist as `LIABILITY` accounts in COA.
- **Missing:** Return Snapshot models, Provider Abstraction, GSTR-1/2B/3B extraction logic.

---

## 3. GSTR-1 Readiness
**Status:** GAP
- **B2B:** `companyGstin` exists on `Sale`, but `registrationType` and `stateCode` must be derived dynamically.
- **B2C:** No native distinction logic exists in controllers; requires implementation.
- **Credit Notes:** `SalesReturn` exists and tracks `creditNoteNo` and `totalTaxable` reductions, but lacks a strict foreign-key linkage to the specific `Sale` item level necessary for precise GST amendment tracing (though it links to `SaleId`).
- **HSN/SAC Summary:** `hsnCode` exists on `SaleItem`, and `unit` exists on `Material`. However, UQC mapping to standard GST codes (e.g., "NOS", "KGS") is not normalized.

---

## 4. GSTR-3B Readiness
**Status:** GAP
- **Outward Supplies:** Can be derived from `Sale` and `SalesReturn`.
- **ITC (Eligible/Ineligible):** `Purchase` has NO `itcEligibility` field. Currently assumes all purchases are 100% eligible.
- **Reverse Charge (RCM):** `Purchase` has NO `rcm` or `reverseCharge` flag. It is impossible to identify RCM transactions with the current schema. **(CRITICAL RISK)**

---

## 5. Purchase / Input Tax Credit Readiness
**Status:** GAP
- `Purchase` and `PurchaseItem` store `taxableAmount`, `gstAmount`, and `vendorGstin`.
- **Deficiencies:** Lacks RCM identifiers, ITC eligibility flags, and POS (Place of Supply) explicitly on the purchase side. 
- **GSTR-2B Readiness:** Completely missing. The system has no tables for `Gstr2B` imports or reconciliation status matching.

---

## 6. GST Reconciliation Readiness
**Status:** GAP
- Current `reconcileGST()` in `reconciliationService.ts` only compares total `igstAmount` on Sales against the GL `2150` account balance. 
- **Missing:** Does not check Purchases (Input GST), Credit Notes, missing source transactions, or duplicate GST lines at a transactional level.

---

## 7. GST Control Accounts
**Status:** PASS (Partially)
- Basic Input/Output accounts exist natively in the COA initialization (`coaService.ts`).
- Accounts are correctly tagged as `CURRENT_LIABILITY`. 
- **Missing:** Accounts for "ITC Deferred", "TDS/TCS Receivable", or explicit "GST Payable/Receivable" netting accounts.

---

## 8. Financial Year / GST Period Architecture
**Status:** RISK
- `requireFinancialYearContext` middleware is completely decoupled from GST reporting. 
- `getGstSummary` uses arbitrary `?from` and `?to` date strings.
- **Requirement:** GST filing must introduce `GstFilingPeriod` (e.g., "April 2026") that is independent of `AccountingPeriod` closure.

---

## 9. Filing Snapshot Gap
**Status:** NOT IMPLEMENTED
- The system cannot freeze a return. If a past Sale is modified (or a backfill occurs), the historical GST summary changes. 
- **Requirement:** A `GstReturn` schema model is needed with JSON `payload` storage and `hash` integrity checks.

---

## 10. Return Lifecycle Gap
**Status:** NOT IMPLEMENTED
- States (DRAFT, RECONCILED, READY_TO_FILE, FILED, AMENDED) do not exist.

---

## 11. Immutability Assessment
**Status:** RISK
- `Sale`, `Purchase`, and `JournalEntry` currently rely on `AccountingPeriod` for immutability. If a GST Return is "FILED", there is no programmatic lock preventing someone from editing a `Sale` if the accounting period remains open.

---

## 12. Provider Architecture
**Status:** NOT IMPLEMENTED
- No interface for `IGstProvider` or `MockGstProvider` exists.

---

## 13. Tenant GST Configuration
**Status:** GAP
- `User` table has `gstin` and `state`.
- **Missing:** `legalName`, `registrationType` (Regular/Composition), `filingFrequency` (Monthly/QRMP).

---

## 14. B2B/B2C Classification
**Status:** NOT IMPLEMENTED
- All sales are stored identically. No logic exists to route Interstate > 2.5L to B2CL, or categorize B2CS vs B2B based on GSTIN presence.

---

## 15. Export Readiness
**Status:** NOT IMPLEMENTED
- No CSV or JSON formatters exist for standard GST Offline Tools.

---

## 16. GSTR-2B Readiness
**Status:** NOT IMPLEMENTED
- "EXTERNAL GSTR-2B IMPORT NOT IMPLEMENTED"
- **Architecture Needed:** 
  Upload JSON/CSV → `Gstr2BImport` table → Match against `Purchase` (by Invoice No, Vendor GSTIN, Date, Value) → Identify (MATCHED, PARTIAL_MATCH, MISSING_IN_BOOKS, MISSING_IN_2B).

---

## 17. Reconciliation Architecture
**Status:** GAP
- The pipeline: `Source -> Books -> GL -> Return -> External` breaks at `GL -> Return` because the "Return" concept doesn't exist yet.

---

## 18. Audit Logging
**Status:** PASS
- The existing `auditLog` function in `auditService.ts` is robust and scalable. It can natively support `GST_RETURN_FILED` events without schema changes.

---

## 19. RBAC
**Status:** PASS
- Middleware `requireAdminOrSuperAdmin` exists and is appropriate for securing filing endpoints.

---

## 20. Period Closure Interaction
**Status:** PASS (Conceptually)
- `AccountingPeriod` is independent. GST filing will not alter financial periods, but it requires a new cross-check to prevent edits to transactions included in a FILED GST return.

---

## 21. Data Quality Findings
**Status:** RISK
- `Sale` allows `companyGstin` to be null but does not enforce a strict correlation between missing GSTIN and "Cash Customer". 
- `customerCity` / `customerPincode` are strings that may lack validation, posing a risk for Place of Supply (POS) rules.

---

## 22. Performance Findings
**Status:** RISK
- `Sale`, `Purchase`, and `SalesReturn` do not have composite indexes on `[userId, invoiceDate, status]` which will be required for rapid GST period extraction.

---

## 23. Security Findings
**Status:** PASS
- Data mutation is strictly controlled. Implementing GST Filing as a read-only payload layer preserves core financial isolation.

---

## 24. Required Schema Changes
```prisma
model GstReturn {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  returnType      String   @db.VarChar(20) // GSTR-1, GSTR-3B
  periodMonth     Int
  periodYear      Int
  status          String   @default("DRAFT") @db.VarChar(20)
  payload         String?  @db.Text
  snapshotHash    String?  @db.VarChar(64)
  ackNo           String?  @db.VarChar(50)
  filedAt         DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
}

// Add to Purchase: rcm Boolean @default(false), itcEligibility String @default("ELIGIBLE")
```

## 25. Required Services
- `Gstr1PreparationService`: Extracts B2B, B2C, CDNR, HSN.
- `Gstr3BPreparationService`: Extracts Outward, ITC, RCM.
- `GstReconciliationService`: Matches Returns to GL.
- `MockGstProvider`: Simulates filing.

## 26. Required Controllers
- `gstFilingController.ts`: Endpoints for preparation, snapshot, and submission.

## 27. Required Routes
- `POST /api/v1/gst/returns/prepare`
- `POST /api/v1/gst/returns/:id/file`

## 28. Required Frontend
- `GstFilingDashboard.tsx`
- `Gstr1ReviewPage.tsx`
- `Gstr3BReviewPage.tsx`

## 29. Required Tests
- `test_gst_filing_immutability.js`
- `test_gstr1_b2b_b2c_classification.js`
- `test_rcm_itc_extraction.js`

## 30. Implementation Sequence
1. **Schema Update:** Add `GstReturn` model, and inject `rcm` / `itcEligibility` into `Purchase`.
2. **Provider & Models:** Implement `MockGstProvider` and extraction logic.
3. **Services:** Write GSTR-1 and GSTR-3B engines.
4. **Controllers & APIs:** Expose to frontend.
5. **Frontend:** Build filing dashboards.
6. **Immutability Hooks:** Lock Sales/Purchases if included in a FILED return.

## 31. Risks
- **RCM Ambiguity:** Past purchases without RCM flags must default to `false` during migration.
- **UQC Normalization:** Existing `unit` strings on `Material` (e.g. "Nos", "Kg") must be dynamically mapped to official GST UQC codes (e.g., "NOS", "KGS").

## 32. Final Recommendation
**PROCEED TO IMPLEMENTATION.**
The existing financial and transaction engines are robust and completely isolated. By adding a strict `GstReturn` schema and extraction layer, Phase 4.5D can be safely achieved without polluting the financial source of truth.

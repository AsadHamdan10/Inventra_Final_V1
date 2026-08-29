# INVENTRA V1 — PHASE 6.6 IMPLEMENTATION PLAN

## Goal Description
Phase 6.6 focuses on completing the ERP operations by exposing existing backend services via REST APIs and building the corresponding frontend React UIs. The primary areas are Procurement, Inventory Operations, Manufacturing, and Financial Statements.

## Architectural Constraints
- **NO Payment Gateways:** Stripe, Razorpay, etc., will not be implemented.
- **NO Duplicate Engines:** Frontend must rely on the backend for all calculations (FIFO, Accounting, Inventory).
- **Backend Authority:** We will expose existing services via controllers rather than rewriting business logic.
- **Strict Role-Based Access Control (RBAC):** Super Admins remain isolated from tenant ERP operations.
- **Tenant Isolation:** All endpoints must enforce `userId` scoping.

## Component 1: Procurement
### Backend (Controllers & Routes)
- `purchaseRequisitionController.ts` & `purchaseRequisitions.ts` route
- `purchaseQuotationController.ts` & `purchaseQuotations.ts` route
- `purchaseOrderController.ts` & `purchaseOrders.ts` route
- `goodsReceiptController.ts` & `goodsReceipts.ts` route

### Frontend (Pages & API Service)
- List, Create, and Detail pages for PR, PQ, PO, and GRN.
- Update `apiServices.ts` to include these endpoints.

## Component 2: Inventory Operations
### Backend
- `inventoryOperationController.ts` & `inventoryOperations.ts` route (for Stock Transfer & Stock Adjustment).

### Frontend
- **Stock Transfer UI:** Source/Destination selection, Item selection, Quantity, atomicity enforcement.
- **Stock Adjustment UI:** Reason required, strict RBAC.
- Update `apiServices.ts` for inventory operations.

## Component 3: Manufacturing
### Backend
- `bomController.ts` & `bom.ts` route
- `workCenterController.ts` & `workCenters.ts` route
- `routingController.ts` & `routings.ts` route
- `productionOrderController.ts` & `productionOrders.ts` route
- `productionExecutionController.ts` & `productionExecutions.ts` route

### Frontend
- **BOM Management:** Finished Good vs Components, scrap %, activation.
- **Routing & Work Centers:** Operation sequences.
- **Production Orders:** Release workflow, snapshot handling.
- **Material Issue:** Consume RAW_MATERIAL from warehouse.
- **Production Output:** Yield FINISHED_GOOD to warehouse.

## Component 4: Financial Statements
### Backend
- `financialStatementController.ts` & `financialStatements.ts` route.
- Will query the authoritative `JournalLine` and `ChartOfAccount` directly to produce:
  - Trial Balance (Debits vs Credits)
  - Profit & Loss (Revenue - Expenses)
  - Balance Sheet (Assets = Liabilities + Equity + Net Profit)

### Frontend
- **Trial Balance Page**
- **Profit & Loss Page**
- **Balance Sheet Page**

## Verification Plan
1. **Automated E2E Script (`test_phase_6_6_erp_operations.js`)**
   - Test Procurement, Inventory, Manufacturing, Finance, Tenant Isolation, and RBAC via the newly created REST APIs.
2. **Regression Testing**
   - Execute all previously created test scripts to ensure Phase 6.1-6.5 functionality remains intact.
3. **Build Check**
   - Execute `npm run build` on both backend and frontend to verify 0 compiler errors.

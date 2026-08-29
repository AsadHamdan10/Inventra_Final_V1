# INVENTRA V1 — MANUAL QA PLAN

## Prerequisites
- All tests execute against an isolated staging environment or local development environment (`inventra_v1_development`).
- Ensure no production data is touched.

---

## TEST 1 — TRADING SALE (E2E)

**Preconditions:**
- Create 1 Trading Item (e.g., "Steel Pipe").
- Create 1 Customer.
- Create 1 Warehouse.
- Create Opening Stock for "Steel Pipe" of 100 units @ $10.

**Steps:**
1. Navigate to Sales -> Create Sale.
2. Select Customer and Warehouse.
3. Add "Steel Pipe", Qty: 20, Selling Price: $15.
4. Post Sale.
5. Post Customer Payment against the Sale.

**Expected Result:**
- Stock decreases to 80 units.
- FIFO cost of $200 (20 * 10) is removed from InventoryLayer.
- Sale records Revenue of $300 (20 * 15).
- COGS journal records $200.
- Customer Balance becomes $0 after Payment.
- General Ledger accurately reflects Cash IN, Revenue, COGS, and Inventory OUT.

---

## TEST 2 — PROCUREMENT (E2E)

**Preconditions:**
- Create Vendor.
- Create Trading Item.

**Steps:**
1. Create Purchase Order for 50 units.
2. Post Goods Receipt Note (GRN) against PO.
3. Create Purchase Invoice from GRN.
4. Post Vendor Payment.

**Expected Result:**
- PO creates NO financial/inventory impact.
- GRN increases stock by 50 units but creates NO financial journals.
- Purchase Invoice creates exact financial journals (DR Inventory, CR Payable).
- Vendor payable decreases to $0 upon Payment.

---

## TEST 3 — MULTI-WAREHOUSE TRANSFER

**Preconditions:**
- Warehouse A has 50 units of "Steel Pipe".
- Warehouse B has 0 units.

**Steps:**
1. Navigate to Inventory -> Stock Transfers.
2. Transfer 20 units from A to B.

**Expected Result:**
- Warehouse A stock becomes 30.
- Warehouse B stock becomes 20.
- Exact FIFO layers from A are consumed and mirrored exactly into B.
- No revenue or expense is recognized (Total Asset Value remains identical).

---

## TEST 4 — MANUFACTURING E2E

**Preconditions:**
- Create Raw Material (RM) with stock.
- Create Finished Good (FG).
- Create BOM (1 FG requires 2 RM).
- Create Routing & Work Center.

**Steps:**
1. Create Production Order for 10 FG.
2. Release Order.
3. Post Material Issue (20 RM).
4. Post Production Output (10 FG).

**Expected Result:**
- RM Stock decreases by 20.
- FG Stock increases by 10.
- RM FIFO cost transfers exactly to WIP.
- WIP transfers exactly to FG Inventory.
- Production Order transitions to COMPLETED.

---

## TEST 5 — PARTIAL PRODUCTION

**Steps:**
1. Create Production Order for 100 FG (requires 200 RM).
2. Release Order.
3. Issue 80 RM.
4. Produce 40 FG.

**Expected Result:**
- RM decreases by 80.
- FG increases by 40.
- Production Order Status is `PARTIALLY_COMPLETED`.
- WIP retains any un-absorbed cost if RM was issued but FG was not fully received.

---

## TEST 6 — GST REPORTING

**Steps:**
1. Create an Interstate B2B Sale (IGST).
2. Create an Intrastate B2C Sale (CGST/SGST).

**Expected Result:**
- GSTR-1 reflects correct B2B vs B2C buckets.
- HSN summary aggregates correctly.
- Tax amounts calculate strictly from line items.

---

## TEST 7 & 8 — E-INVOICE & E-WAY BILL

**Steps:**
1. Generate E-Invoice for B2B Sale.
2. Generate E-Way Bill for the same Sale.
3. Attempt duplicate generation.

**Expected Result:**
- IRN/AckNo stored safely on Sale.
- EWB Details stored on Sale.
- Duplicate generation is hard-rejected by unique constraints.

---

## TEST 9 & 10 — FINANCIAL PERIOD & GST LOCKS

**Steps:**
1. Close Accounting Period for Current Month.
2. Attempt to create a Sale backdated to yesterday.
3. Mark GST Period FILED.
4. Attempt to modify a transaction in that period.

**Expected Result:**
- Both mutations are completely blocked with strict Error Codes (`PERIOD_CLOSED`, `GST_RETURN_LOCKED`).

-- ── Professional GST Invoice Template — additive-only migration ──
-- Adds new NULLABLE columns to "sales" only. Does NOT:
--   * modify or rename any existing column
--   * drop or recreate any table
--   * touch any existing row's data (all new columns default to NULL)
--   * affect any other table
--
-- Every existing invoice / API response / template keeps working exactly
-- as before — these columns are only populated when a user explicitly
-- fills in the new "Additional Invoice Details" / "Ship To" sections.

-- AlterTable
ALTER TABLE "sales"
  ADD COLUMN "reference_no" VARCHAR(100),
  ADD COLUMN "reference_date" DATE,
  ADD COLUMN "delivery_note" VARCHAR(200),
  ADD COLUMN "buyer_order_no" VARCHAR(100),
  ADD COLUMN "buyer_order_date" DATE,
  ADD COLUMN "dispatch_doc_no" VARCHAR(100),
  ADD COLUMN "delivery_note_date" DATE,
  ADD COLUMN "mode_of_payment" VARCHAR(100),
  ADD COLUMN "other_reference" VARCHAR(200),
  ADD COLUMN "transport_name" VARCHAR(200),
  ADD COLUMN "lr_number" VARCHAR(100),
  ADD COLUMN "destination" VARCHAR(200),
  ADD COLUMN "vehicle_number" VARCHAR(50),
  ADD COLUMN "eway_bill_no" VARCHAR(50),
  ADD COLUMN "terms_of_delivery" TEXT,
  ADD COLUMN "ship_company_name" VARCHAR(200),
  ADD COLUMN "ship_address_line1" TEXT,
  ADD COLUMN "ship_address_line2" TEXT,
  ADD COLUMN "ship_city" VARCHAR(100),
  ADD COLUMN "ship_state" VARCHAR(100),
  ADD COLUMN "ship_pincode" VARCHAR(20),
  ADD COLUMN "ship_gstin" TEXT,
  ADD COLUMN "ship_contact_person" VARCHAR(150),
  ADD COLUMN "ship_mobile" VARCHAR(20),
  ADD COLUMN "use_buyer_as_shipping" BOOLEAN;

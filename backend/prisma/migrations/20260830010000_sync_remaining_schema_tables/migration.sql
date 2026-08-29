-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('TRADING', 'MANUFACTURING', 'BOTH');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('TRADING_GOOD', 'RAW_MATERIAL', 'SEMI_FINISHED_GOOD', 'FINISHED_GOOD', 'SERVICE');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('GENERAL', 'RAW_MATERIAL', 'PRODUCTION', 'FINISHED_GOODS', 'REJECTED', 'QUARANTINE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Status" ADD VALUE 'activation_pending';
ALTER TYPE "Status" ADD VALUE 'active';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "entity_id" INTEGER,
ADD COLUMN     "entity_type" VARCHAR(100),
ADD COLUMN     "status" VARCHAR(50);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "opening_balance_date" DATE;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "gst_input_bills" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "batch_ready" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "current_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expiry_ready" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gst_rate" DECIMAL(5,2),
ADD COLUMN     "inventory_tracked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "item_code" VARCHAR(50),
ADD COLUMN     "item_type" "ItemType" NOT NULL DEFAULT 'TRADING_GOOD',
ADD COLUMN     "purchase_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sales_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "standard_cost" DECIMAL(15,2),
ADD COLUMN     "standard_price" DECIMAL(15,2),
ADD COLUMN     "taxability" VARCHAR(30) NOT NULL DEFAULT 'TAXABLE';

-- AlterTable
ALTER TABLE "purchase_items" ADD COLUMN     "material_id" INTEGER,
ALTER COLUMN "purchase_rate" DROP NOT NULL,
ALTER COLUMN "purchase_rate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "itcEligibility" VARCHAR(30) NOT NULL DEFAULT 'ELIGIBLE',
ADD COLUMN     "purchase_order_id" INTEGER,
ADD COLUMN     "rcm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "material_id" INTEGER,
ALTER COLUMN "purchase_price" DROP NOT NULL,
ALTER COLUMN "purchase_price" DROP DEFAULT,
ALTER COLUMN "avg_purchase_cost" DROP NOT NULL,
ALTER COLUMN "avg_purchase_cost" DROP DEFAULT,
ALTER COLUMN "item_profit" DROP NOT NULL,
ALTER COLUMN "item_profit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "customer_city" VARCHAR(100),
ADD COLUMN     "customer_pincode" VARCHAR(20),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "total_purchase_cost" DROP NOT NULL,
ALTER COLUMN "total_purchase_cost" DROP DEFAULT,
ALTER COLUMN "gross_profit" DROP NOT NULL,
ALTER COLUMN "gross_profit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_sequences" ADD COLUMN     "document_type" VARCHAR(20) NOT NULL DEFAULT 'INV',
ADD COLUMN     "financial_year" VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
ALTER COLUMN "prefix" SET DEFAULT '';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alternate_phone" TEXT,
ADD COLUMN     "application_ref" VARCHAR(50),
ADD COLUMN     "contact_person" VARCHAR(150),
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
ADD COLUMN     "date_format" VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "full_name" VARCHAR(150),
ADD COLUMN     "last_failed_login" TIMESTAMP(3),
ADD COLUMN     "legal_name" VARCHAR(200),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "number_format" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
ADD COLUMN     "plan" VARCHAR(50) NOT NULL DEFAULT 'V1_BASIC',
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "subscription_end" TIMESTAMP(3),
ADD COLUMN     "subscription_start" TIMESTAMP(3),
ADD COLUMN     "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "trading_name" VARCHAR(200),
ADD COLUMN     "website" VARCHAR(255),
ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "opening_balance_date" DATE;

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "period_number" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "accountType" VARCHAR(50) NOT NULL,
    "accountSubType" VARCHAR(100),
    "parent_id" INTEGER,
    "is_system_account" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment_allocations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "amount_allocated" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "unallocated" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "mode" VARCHAR(50) NOT NULL DEFAULT 'Cash',
    "reference" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dc_invoice_items" (
    "id" SERIAL NOT NULL,
    "delivery_challan_item_id" INTEGER NOT NULL,
    "sale_item_id" INTEGER NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dc_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challan_items" (
    "id" SERIAL NOT NULL,
    "delivery_challan_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "quotation_item_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'Nos',
    "notes" TEXT,

    CONSTRAINT "delivery_challan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "quotation_id" INTEGER,
    "dc_no" VARCHAR(100),
    "dc_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "vehicle_number" VARCHAR(50),
    "transporter_name" VARCHAR(200),
    "place_of_supply" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_layers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "sourceType" VARCHAR(50) NOT NULL,
    "source_id" INTEGER,
    "received_date" DATE NOT NULL,
    "original_qty" DECIMAL(15,3) NOT NULL,
    "remaining_qty" DECIMAL(15,3) NOT NULL,
    "unit_cost_enc" TEXT NOT NULL,
    "warehouse_id" INTEGER,

    CONSTRAINT "inventory_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "txn_date" DATE NOT NULL,
    "movementType" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "referenceType" VARCHAR(50) NOT NULL,
    "reference_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" INTEGER,

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "journal_no" VARCHAR(100),
    "journal_date" DATE NOT NULL,
    "description" TEXT,
    "reference_type" VARCHAR(50),
    "reference_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMP(3),
    "posted_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "journal_entry_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layer_consumptions" (
    "production_material_issue_id" INTEGER,
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "layer_id" INTEGER NOT NULL,
    "sale_item_id" INTEGER,
    "quantity_consumed" DECIMAL(15,3) NOT NULL,
    "unit_cost_enc" TEXT NOT NULL,

    CONSTRAINT "layer_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_items" (
    "id" SERIAL NOT NULL,
    "purchase_return_id" INTEGER NOT NULL,
    "purchase_item_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "item_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "vendor_id" INTEGER,
    "debit_note_no" VARCHAR(100),
    "return_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "total_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "rcm" BOOLEAN NOT NULL DEFAULT false,
    "itcEligibility" VARCHAR(30) NOT NULL DEFAULT 'ELIGIBLE',
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" SERIAL NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "hsn_code" VARCHAR(20),
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "item_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "quotation_no" VARCHAR(100),
    "quotation_date" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "terms_and_conditions" TEXT,
    "total_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "converted_sale_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_items" (
    "id" SERIAL NOT NULL,
    "sales_return_id" INTEGER NOT NULL,
    "sale_item_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "item_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "credit_note_no" VARCHAR(100),
    "customer_city" VARCHAR(100),
    "customer_pincode" VARCHAR(20),
    "return_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "total_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payment_allocations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "amount_allocated" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "unallocated" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "mode" VARCHAR(50) NOT NULL DEFAULT 'Cash',
    "reference" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "e_invoices" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sale_id" INTEGER,
    "sales_return_id" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'NOT_GENERATED',
    "irn" VARCHAR(64),
    "ack_no" VARCHAR(20),
    "ack_date" TIMESTAMP(3),
    "qr_code" TEXT,
    "signed_invoice" TEXT,
    "error_details" TEXT,
    "cancel_date" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "provider" VARCHAR(50) DEFAULT 'MOCK_IRP',
    "generated_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "government_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "e_way_bills" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sale_id" INTEGER,
    "sales_return_id" INTEGER,
    "delivery_challan_id" INTEGER,
    "ewb_no" VARCHAR(30),
    "status" VARCHAR(50) NOT NULL DEFAULT 'NOT_GENERATED',
    "document_type" VARCHAR(30),
    "document_no" VARCHAR(100),
    "document_date" TIMESTAMP(3),
    "supply_type" VARCHAR(30),
    "sub_supply_type" VARCHAR(50),
    "sub_supply_description" VARCHAR(500),
    "transporter_id" VARCHAR(50),
    "transporter_name" VARCHAR(200),
    "transport_mode" VARCHAR(30),
    "transport_doc_no" VARCHAR(100),
    "transport_doc_date" TIMESTAMP(3),
    "vehicle_no" VARCHAR(50),
    "vehicle_type" VARCHAR(20),
    "from_place" VARCHAR(200),
    "from_state" VARCHAR(100),
    "from_pincode" VARCHAR(20),
    "to_place" VARCHAR(200),
    "to_state" VARCHAR(100),
    "to_pincode" VARCHAR(20),
    "approx_distance" INTEGER,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "extended_at" TIMESTAMP(3),
    "extension_reason" TEXT,
    "payload" TEXT,
    "response_payload" TEXT,
    "error_details" TEXT,
    "is_mock" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_way_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_returns" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "return_type" VARCHAR(20) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "payload" TEXT,
    "snapshot_hash" VARCHAR(64),
    "ack_no" VARCHAR(50),
    "filed_at" TIMESTAMP(3),
    "error_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_configurations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_type" "BusinessType" NOT NULL DEFAULT 'TRADING',
    "enabled_modules" TEXT NOT NULL DEFAULT '[]',
    "default_warehouse_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(20),
    "warehouse_type" "WarehouseType" NOT NULL DEFAULT 'GENERAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "requisition_no" VARCHAR(50) NOT NULL,
    "requisition_date" DATE NOT NULL,
    "requested_by" VARCHAR(100),
    "department" VARCHAR(100),
    "warehouse_id" INTEGER,
    "required_date" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_items" (
    "id" SERIAL NOT NULL,
    "purchase_requisition_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "required_date" DATE,
    "remarks" TEXT,

    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quotation_no" VARCHAR(50) NOT NULL,
    "quotation_date" DATE NOT NULL,
    "validity_date" DATE,
    "vendor_id" INTEGER,
    "vendor_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INTEGER,
    "purchase_requisition_id" INTEGER,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "remarks" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "total_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotation_items" (
    "id" SERIAL NOT NULL,
    "purchase_quotation_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "rate" DECIMAL(15,4) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "item_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" DATE NOT NULL,
    "vendor_id" INTEGER,
    "vendor_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INTEGER,
    "purchase_requisition_id" INTEGER,
    "purchase_quotation_id" INTEGER,
    "expected_delivery_date" DATE,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "shipping_address" TEXT,
    "billing_address" TEXT,
    "remarks" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "total_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "ordered_qty" DECIMAL(15,3) NOT NULL,
    "received_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "pending_qty" DECIMAL(15,3) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "rate" DECIMAL(15,4) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "item_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "warehouse_id" INTEGER,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "grn_no" VARCHAR(50) NOT NULL,
    "grn_date" DATE NOT NULL,
    "vendor_id" INTEGER,
    "vendor_name" VARCHAR(200) NOT NULL,
    "warehouse_id" INTEGER,
    "purchase_order_id" INTEGER,
    "delivery_challan_no" VARCHAR(100),
    "transporter" VARCHAR(200),
    "vehicle_no" VARCHAR(50),
    "remarks" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" SERIAL NOT NULL,
    "goods_receipt_id" INTEGER NOT NULL,
    "material_id" INTEGER,
    "material_name" VARCHAR(200) NOT NULL,
    "ordered_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "received_qty" DECIMAL(15,3) NOT NULL,
    "accepted_qty" DECIMAL(15,3) NOT NULL,
    "rejected_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "unit" VARCHAR(50) NOT NULL,
    "warehouse_id" INTEGER,
    "batch_no" VARCHAR(100),
    "expiry_date" DATE,
    "remarks" TEXT,
    "purchase_order_item_id" INTEGER,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_goods_receipts" (
    "id" SERIAL NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "goods_receipt_id" INTEGER NOT NULL,

    CONSTRAINT "purchase_goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "bom_code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "finished_good_item_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" VARCHAR(50) NOT NULL DEFAULT 'V1',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "output_quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "output_unit" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_of_material_items" (
    "id" SERIAL NOT NULL,
    "bom_id" INTEGER NOT NULL,
    "component_item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "scrap_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "warehouse_id" INTEGER,
    "notes" TEXT,

    CONSTRAINT "bill_of_material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "work_center_type" VARCHAR(100) NOT NULL,
    "warehouse_id" INTEGER,
    "capacity" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "capacity_unit" VARCHAR(50),
    "efficiency_percent" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "finished_good_item_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_operations" (
    "id" SERIAL NOT NULL,
    "routing_id" INTEGER NOT NULL,
    "operation_sequence" INTEGER NOT NULL,
    "operation_code" VARCHAR(100) NOT NULL,
    "operation_name" VARCHAR(200) NOT NULL,
    "work_center_id" INTEGER NOT NULL,
    "setup_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "run_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "queue_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "move_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wait_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "routing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "production_order_no" VARCHAR(100) NOT NULL,
    "production_date" DATE NOT NULL,
    "item_id" INTEGER NOT NULL,
    "planned_quantity" DECIMAL(15,3) NOT NULL,
    "completed_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "warehouse_id" INTEGER NOT NULL,
    "bom_id" INTEGER,
    "routing_id" INTEGER,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "priority" VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    "planned_start_date" DATE,
    "planned_end_date" DATE,
    "actual_start_date" DATE,
    "actual_end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_components" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "component_item_id" INTEGER NOT NULL,
    "required_quantity" DECIMAL(15,6) NOT NULL,
    "issued_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "consumed_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "scrap_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "unit" VARCHAR(50) NOT NULL,
    "warehouse_id" INTEGER,

    CONSTRAINT "production_order_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_operations" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "operation_sequence" INTEGER NOT NULL,
    "operation_code" VARCHAR(100) NOT NULL,
    "operation_name" VARCHAR(200) NOT NULL,
    "work_center_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "setup_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "run_time" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_executions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "execution_no" VARCHAR(100) NOT NULL,
    "execution_date" DATE NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    "total_material_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "total_fg_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_material_issues" (
    "id" SERIAL NOT NULL,
    "execution_id" INTEGER NOT NULL,
    "component_item_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "actual_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "inventory_ledger_out_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_material_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_outputs" (
    "id" SERIAL NOT NULL,
    "execution_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "actual_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "inventory_ledger_in_id" INTEGER,
    "inventory_layer_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transfer_no" VARCHAR(100) NOT NULL,
    "transfer_date" DATE NOT NULL,
    "source_warehouse_id" INTEGER NOT NULL,
    "destination_warehouse_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_by" INTEGER NOT NULL,
    "posted_by" INTEGER,
    "cancelled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" SERIAL NOT NULL,
    "stock_transfer_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "actual_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "line_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "adjustment_no" VARCHAR(100) NOT NULL,
    "adjustment_date" DATE NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "posted_by" INTEGER,
    "cancelled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" SERIAL NOT NULL,
    "stock_adjustment_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "adjustment_type" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "unit_cost" DECIMAL(15,3) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_snapshots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "application_ref" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150),
    "company_name" VARCHAR(200) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "mobile" TEXT,
    "business_type" VARCHAR(50),
    "industry" VARCHAR(100),
    "plan" VARCHAR(50) NOT NULL DEFAULT 'V1_BASIC',
    "billing_cycle" VARCHAR(20),
    "original_status" VARCHAR(50),
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,

    CONSTRAINT "application_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "annual_price" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "business_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "list_price" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_payments" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount_received" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "transaction_reference" VARCHAR(100),
    "receipt_number" VARCHAR(100),
    "notes" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_commissions" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "marketer_name" VARCHAR(150) NOT NULL,
    "commission_amount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_expenses" (
    "id" SERIAL NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" VARCHAR(255),
    "reference" VARCHAR(100),
    "notes" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_user_id_financial_year_id_period_number_key" ON "accounting_periods"("user_id", "financial_year_id", "period_number");

-- CreateIndex
CREATE INDEX "chart_of_accounts_accountType_idx" ON "chart_of_accounts"("accountType");

-- CreateIndex
CREATE INDEX "chart_of_accounts_is_active_idx" ON "chart_of_accounts"("is_active");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parent_id_idx" ON "chart_of_accounts"("parent_id");

-- CreateIndex
CREATE INDEX "chart_of_accounts_user_id_idx" ON "chart_of_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_user_id_code_key" ON "chart_of_accounts"("user_id", "code");

-- CreateIndex
CREATE INDEX "customer_payment_allocations_payment_id_idx" ON "customer_payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "customer_payment_allocations_sale_id_idx" ON "customer_payment_allocations"("sale_id");

-- CreateIndex
CREATE INDEX "customer_payment_allocations_user_id_idx" ON "customer_payment_allocations"("user_id");

-- CreateIndex
CREATE INDEX "customer_payments_customer_id_idx" ON "customer_payments"("customer_id");

-- CreateIndex
CREATE INDEX "customer_payments_user_id_idx" ON "customer_payments"("user_id");

-- CreateIndex
CREATE INDEX "dc_invoice_items_delivery_challan_item_id_idx" ON "dc_invoice_items"("delivery_challan_item_id");

-- CreateIndex
CREATE INDEX "dc_invoice_items_sale_id_idx" ON "dc_invoice_items"("sale_id");

-- CreateIndex
CREATE INDEX "dc_invoice_items_sale_item_id_idx" ON "dc_invoice_items"("sale_item_id");

-- CreateIndex
CREATE INDEX "delivery_challan_items_delivery_challan_id_idx" ON "delivery_challan_items"("delivery_challan_id");

-- CreateIndex
CREATE INDEX "delivery_challan_items_material_id_idx" ON "delivery_challan_items"("material_id");

-- CreateIndex
CREATE INDEX "delivery_challans_customer_id_idx" ON "delivery_challans"("customer_id");

-- CreateIndex
CREATE INDEX "delivery_challans_quotation_id_idx" ON "delivery_challans"("quotation_id");

-- CreateIndex
CREATE INDEX "delivery_challans_user_id_idx" ON "delivery_challans"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_user_id_start_date_end_date_key" ON "financial_years"("user_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "inventory_layers_user_id_material_id_remaining_qty_received_idx" ON "inventory_layers"("user_id", "material_id", "remaining_qty", "received_date", "id");

-- CreateIndex
CREATE INDEX "inventory_layers_user_id_material_id_warehouse_id_idx" ON "inventory_layers"("user_id", "material_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_layers_user_id_received_date_idx" ON "inventory_layers"("user_id", "received_date");

-- CreateIndex
CREATE INDEX "inventory_ledger_referenceType_reference_id_idx" ON "inventory_ledger"("referenceType", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_ledger_user_id_material_id_txn_date_idx" ON "inventory_ledger"("user_id", "material_id", "txn_date");

-- CreateIndex
CREATE INDEX "inventory_ledger_user_id_warehouseId_txn_date_idx" ON "inventory_ledger"("user_id", "warehouseId", "txn_date");

-- CreateIndex
CREATE INDEX "journal_entries_journal_date_idx" ON "journal_entries"("journal_date");

-- CreateIndex
CREATE INDEX "journal_entries_reference_type_reference_id_idx" ON "journal_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "journal_entries_user_id_idx" ON "journal_entries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_user_id_journal_no_key" ON "journal_entries"("user_id", "journal_no");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_user_id_idx" ON "journal_lines"("user_id");

-- CreateIndex
CREATE INDEX "journal_lines_user_id_account_id_idx" ON "journal_lines"("user_id", "account_id");

-- CreateIndex
CREATE INDEX "layer_consumptions_user_id_layer_id_idx" ON "layer_consumptions"("user_id", "layer_id");

-- CreateIndex
CREATE INDEX "layer_consumptions_user_id_sale_item_id_idx" ON "layer_consumptions"("user_id", "sale_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_material_id_idx" ON "purchase_return_items"("material_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_purchase_item_id_idx" ON "purchase_return_items"("purchase_item_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_purchase_return_id_idx" ON "purchase_return_items"("purchase_return_id");

-- CreateIndex
CREATE INDEX "purchase_returns_purchase_id_idx" ON "purchase_returns"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_returns_user_id_idx" ON "purchase_returns"("user_id");

-- CreateIndex
CREATE INDEX "purchase_returns_vendor_id_idx" ON "purchase_returns"("vendor_id");

-- CreateIndex
CREATE INDEX "quotation_items_material_id_idx" ON "quotation_items"("material_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_converted_sale_id_key" ON "quotations"("converted_sale_id");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE INDEX "quotations_user_id_idx" ON "quotations"("user_id");

-- CreateIndex
CREATE INDEX "sales_return_items_material_id_idx" ON "sales_return_items"("material_id");

-- CreateIndex
CREATE INDEX "sales_return_items_sale_item_id_idx" ON "sales_return_items"("sale_item_id");

-- CreateIndex
CREATE INDEX "sales_return_items_sales_return_id_idx" ON "sales_return_items"("sales_return_id");

-- CreateIndex
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns"("customer_id");

-- CreateIndex
CREATE INDEX "sales_returns_sale_id_idx" ON "sales_returns"("sale_id");

-- CreateIndex
CREATE INDEX "sales_returns_user_id_idx" ON "sales_returns"("user_id");

-- CreateIndex
CREATE INDEX "sales_returns_user_id_return_date_status_idx" ON "sales_returns"("user_id", "return_date", "status");

-- CreateIndex
CREATE INDEX "vendor_payment_allocations_payment_id_idx" ON "vendor_payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "vendor_payment_allocations_purchase_id_idx" ON "vendor_payment_allocations"("purchase_id");

-- CreateIndex
CREATE INDEX "vendor_payment_allocations_user_id_idx" ON "vendor_payment_allocations"("user_id");

-- CreateIndex
CREATE INDEX "vendor_payments_user_id_idx" ON "vendor_payments"("user_id");

-- CreateIndex
CREATE INDEX "vendor_payments_vendor_id_idx" ON "vendor_payments"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_invoices_sale_id_key" ON "e_invoices"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_invoices_sales_return_id_key" ON "e_invoices"("sales_return_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_invoices_irn_key" ON "e_invoices"("irn");

-- CreateIndex
CREATE INDEX "e_invoices_user_id_idx" ON "e_invoices"("user_id");

-- CreateIndex
CREATE INDEX "e_invoices_status_idx" ON "e_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "e_way_bills_sale_id_key" ON "e_way_bills"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_way_bills_sales_return_id_key" ON "e_way_bills"("sales_return_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_way_bills_delivery_challan_id_key" ON "e_way_bills"("delivery_challan_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_way_bills_ewb_no_key" ON "e_way_bills"("ewb_no");

-- CreateIndex
CREATE INDEX "e_way_bills_user_id_idx" ON "e_way_bills"("user_id");

-- CreateIndex
CREATE INDEX "e_way_bills_status_idx" ON "e_way_bills"("status");

-- CreateIndex
CREATE INDEX "e_way_bills_sale_id_idx" ON "e_way_bills"("sale_id");

-- CreateIndex
CREATE INDEX "e_way_bills_sales_return_id_idx" ON "e_way_bills"("sales_return_id");

-- CreateIndex
CREATE INDEX "e_way_bills_delivery_challan_id_idx" ON "e_way_bills"("delivery_challan_id");

-- CreateIndex
CREATE INDEX "e_way_bills_document_date_idx" ON "e_way_bills"("document_date");

-- CreateIndex
CREATE INDEX "gst_returns_user_id_idx" ON "gst_returns"("user_id");

-- CreateIndex
CREATE INDEX "gst_returns_user_id_period_year_period_month_idx" ON "gst_returns"("user_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "gst_returns_status_idx" ON "gst_returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_returns_user_id_return_type_period_month_period_year_key" ON "gst_returns"("user_id", "return_type", "period_month", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configurations_user_id_key" ON "tenant_configurations"("user_id");

-- CreateIndex
CREATE INDEX "item_categories_user_id_idx" ON "item_categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_user_id_code_key" ON "item_categories"("user_id", "code");

-- CreateIndex
CREATE INDEX "warehouses_user_id_idx" ON "warehouses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_user_id_code_key" ON "warehouses"("user_id", "code");

-- CreateIndex
CREATE INDEX "purchase_requisitions_user_id_idx" ON "purchase_requisitions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_user_id_requisition_no_key" ON "purchase_requisitions"("user_id", "requisition_no");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_purchase_requisition_id_idx" ON "purchase_requisition_items"("purchase_requisition_id");

-- CreateIndex
CREATE INDEX "purchase_quotations_user_id_idx" ON "purchase_quotations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_quotations_user_id_quotation_no_key" ON "purchase_quotations"("user_id", "quotation_no");

-- CreateIndex
CREATE INDEX "purchase_quotation_items_purchase_quotation_id_idx" ON "purchase_quotation_items"("purchase_quotation_id");

-- CreateIndex
CREATE INDEX "purchase_orders_user_id_order_date_status_idx" ON "purchase_orders"("user_id", "order_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_user_id_order_no_key" ON "purchase_orders"("user_id", "order_no");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_material_id_idx" ON "purchase_order_items"("purchase_order_id", "material_id");

-- CreateIndex
CREATE INDEX "goods_receipts_user_id_grn_date_status_idx" ON "goods_receipts"("user_id", "grn_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_user_id_grn_no_key" ON "goods_receipts"("user_id", "grn_no");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goods_receipt_id_material_id_idx" ON "goods_receipt_items"("goods_receipt_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_goods_receipts_purchase_id_goods_receipt_id_key" ON "purchase_goods_receipts"("purchase_id", "goods_receipt_id");

-- CreateIndex
CREATE INDEX "bill_of_materials_user_id_finished_good_item_id_status_idx" ON "bill_of_materials"("user_id", "finished_good_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_user_id_bom_code_revision_key" ON "bill_of_materials"("user_id", "bom_code", "revision");

-- CreateIndex
CREATE INDEX "bill_of_material_items_bom_id_component_item_id_idx" ON "bill_of_material_items"("bom_id", "component_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_centers_user_id_code_key" ON "work_centers"("user_id", "code");

-- CreateIndex
CREATE INDEX "routings_user_id_finished_good_item_id_status_idx" ON "routings"("user_id", "finished_good_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "routings_user_id_code_version_key" ON "routings"("user_id", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "routing_operations_routing_id_operation_sequence_key" ON "routing_operations"("routing_id", "operation_sequence");

-- CreateIndex
CREATE INDEX "production_orders_user_id_production_date_status_idx" ON "production_orders"("user_id", "production_date", "status");

-- CreateIndex
CREATE INDEX "production_orders_user_id_status_idx" ON "production_orders"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_user_id_production_order_no_key" ON "production_orders"("user_id", "production_order_no");

-- CreateIndex
CREATE INDEX "production_order_components_production_order_id_component_i_idx" ON "production_order_components"("production_order_id", "component_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_operations_production_order_id_operation_s_key" ON "production_order_operations"("production_order_id", "operation_sequence");

-- CreateIndex
CREATE INDEX "production_executions_production_order_id_idx" ON "production_executions"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_executions_user_id_execution_no_key" ON "production_executions"("user_id", "execution_no");

-- CreateIndex
CREATE INDEX "production_material_issues_execution_id_component_item_id_idx" ON "production_material_issues"("execution_id", "component_item_id");

-- CreateIndex
CREATE INDEX "production_outputs_execution_id_idx" ON "production_outputs"("execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_user_id_transfer_no_key" ON "stock_transfers"("user_id", "transfer_no");

-- CreateIndex
CREATE INDEX "stock_transfer_items_stock_transfer_id_idx" ON "stock_transfer_items"("stock_transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_user_id_adjustment_no_key" ON "stock_adjustments"("user_id", "adjustment_no");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_stock_adjustment_id_idx" ON "stock_adjustment_items"("stock_adjustment_id");

-- CreateIndex
CREATE UNIQUE INDEX "activation_tokens_token_hash_key" ON "activation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "activation_tokens_user_id_idx" ON "activation_tokens"("user_id");

-- CreateIndex
CREATE INDEX "activation_tokens_token_hash_idx" ON "activation_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "application_snapshots_user_id_key" ON "application_snapshots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_snapshots_application_ref_key" ON "application_snapshots"("application_ref");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_code_key" ON "saas_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_user_id_item_code_key" ON "materials"("user_id", "item_code");

-- CreateIndex
CREATE INDEX "purchase_items_material_id_idx" ON "purchase_items"("material_id");

-- CreateIndex
CREATE INDEX "purchases_user_id_bill_date_status_idx" ON "purchases"("user_id", "bill_date", "status");

-- CreateIndex
CREATE INDEX "sale_items_material_id_idx" ON "sale_items"("material_id");

-- CreateIndex
CREATE INDEX "sales_user_id_invoice_date_status_idx" ON "sales"("user_id", "invoice_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_application_ref_key" ON "users"("application_ref");

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "customer_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dc_invoice_items" ADD CONSTRAINT "dc_invoice_items_delivery_challan_item_id_fkey" FOREIGN KEY ("delivery_challan_item_id") REFERENCES "delivery_challan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dc_invoice_items" ADD CONSTRAINT "dc_invoice_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dc_invoice_items" ADD CONSTRAINT "dc_invoice_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_delivery_challan_id_fkey" FOREIGN KEY ("delivery_challan_id") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_quotation_item_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "quotation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_layers" ADD CONSTRAINT "inventory_layers_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_layers" ADD CONSTRAINT "inventory_layers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_layers" ADD CONSTRAINT "inventory_layers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layer_consumptions" ADD CONSTRAINT "layer_consumptions_production_material_issue_id_fkey" FOREIGN KEY ("production_material_issue_id") REFERENCES "production_material_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layer_consumptions" ADD CONSTRAINT "layer_consumptions_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "inventory_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layer_consumptions" ADD CONSTRAINT "layer_consumptions_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layer_consumptions" ADD CONSTRAINT "layer_consumptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_sale_id_fkey" FOREIGN KEY ("converted_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "vendor_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_invoices" ADD CONSTRAINT "e_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_invoices" ADD CONSTRAINT "e_invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_invoices" ADD CONSTRAINT "e_invoices_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_way_bills" ADD CONSTRAINT "e_way_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_way_bills" ADD CONSTRAINT "e_way_bills_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_way_bills" ADD CONSTRAINT "e_way_bills_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_way_bills" ADD CONSTRAINT "e_way_bills_delivery_challan_id_fkey" FOREIGN KEY ("delivery_challan_id") REFERENCES "delivery_challans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_returns" ADD CONSTRAINT "gst_returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_configurations" ADD CONSTRAINT "tenant_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_configurations" ADD CONSTRAINT "tenant_configurations_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_purchase_requisition_id_fkey" FOREIGN KEY ("purchase_requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_purchase_requisition_id_fkey" FOREIGN KEY ("purchase_requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_purchase_quotation_id_fkey" FOREIGN KEY ("purchase_quotation_id") REFERENCES "purchase_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_requisition_id_fkey" FOREIGN KEY ("purchase_requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_quotation_id_fkey" FOREIGN KEY ("purchase_quotation_id") REFERENCES "purchase_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_goods_receipts" ADD CONSTRAINT "purchase_goods_receipts_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_goods_receipts" ADD CONSTRAINT "purchase_goods_receipts_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_finished_good_item_id_fkey" FOREIGN KEY ("finished_good_item_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_material_items" ADD CONSTRAINT "bill_of_material_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_material_items" ADD CONSTRAINT "bill_of_material_items_component_item_id_fkey" FOREIGN KEY ("component_item_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_material_items" ADD CONSTRAINT "bill_of_material_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routings" ADD CONSTRAINT "routings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routings" ADD CONSTRAINT "routings_finished_good_item_id_fkey" FOREIGN KEY ("finished_good_item_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_components" ADD CONSTRAINT "production_order_components_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_components" ADD CONSTRAINT "production_order_components_component_item_id_fkey" FOREIGN KEY ("component_item_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_components" ADD CONSTRAINT "production_order_components_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_operations" ADD CONSTRAINT "production_order_operations_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_operations" ADD CONSTRAINT "production_order_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_executions" ADD CONSTRAINT "production_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_executions" ADD CONSTRAINT "production_executions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_executions" ADD CONSTRAINT "production_executions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "production_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_component_item_id_fkey" FOREIGN KEY ("component_item_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_inventory_ledger_out_id_fkey" FOREIGN KEY ("inventory_ledger_out_id") REFERENCES "inventory_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "production_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_inventory_ledger_in_id_fkey" FOREIGN KEY ("inventory_ledger_in_id") REFERENCES "inventory_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_inventory_layer_id_fkey" FOREIGN KEY ("inventory_layer_id") REFERENCES "inventory_layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stock_transfer_id_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_tokens" ADD CONSTRAINT "activation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_snapshots" ADD CONSTRAINT "application_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_commissions" ADD CONSTRAINT "saas_commissions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "saas_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


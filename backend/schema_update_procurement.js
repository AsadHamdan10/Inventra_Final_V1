const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema += `
// ==========================================
// PHASE 5.2: PROCUREMENT ENGINE
// ==========================================

model PurchaseRequisition {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  requisitionNo   String   @map("requisition_no") @db.VarChar(50)
  requisitionDate DateTime @map("requisition_date") @db.Date
  requestedBy     String?  @map("requested_by") @db.VarChar(100)
  department      String?  @db.VarChar(100)
  warehouseId     Int?     @map("warehouse_id")
  requiredDate    DateTime? @map("required_date") @db.Date
  status          String   @default("DRAFT") @db.VarChar(30)
  remarks         String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse       Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  items           PurchaseRequisitionItem[]
  quotations      PurchaseQuotation[]
  purchaseOrders  PurchaseOrder[]

  @@unique([userId, requisitionNo])
  @@index([userId])
  @@map("purchase_requisitions")
}

model PurchaseRequisitionItem {
  id                    Int      @id @default(autoincrement())
  purchaseRequisitionId Int      @map("purchase_requisition_id")
  materialId            Int?     @map("material_id")
  materialName          String   @map("material_name") @db.VarChar(200)
  quantity              Decimal  @db.Decimal(15, 3)
  unit                  String   @db.VarChar(50)
  requiredDate          DateTime? @map("required_date") @db.Date
  remarks               String?  @db.Text

  purchaseRequisition PurchaseRequisition @relation(fields: [purchaseRequisitionId], references: [id], onDelete: Cascade)
  material            Material?           @relation(fields: [materialId], references: [id], onDelete: SetNull)

  @@index([purchaseRequisitionId])
  @@map("purchase_requisition_items")
}

model PurchaseQuotation {
  id                    Int      @id @default(autoincrement())
  userId                Int      @map("user_id")
  quotationNo           String   @map("quotation_no") @db.VarChar(50)
  quotationDate         DateTime @map("quotation_date") @db.Date
  validityDate          DateTime? @map("validity_date") @db.Date
  vendorId              Int?     @map("vendor_id")
  vendorName            String   @map("vendor_name") @db.VarChar(200)
  warehouseId           Int?     @map("warehouse_id")
  purchaseRequisitionId Int?     @map("purchase_requisition_id")
  paymentTerms          String?  @map("payment_terms") @db.Text
  deliveryTerms         String?  @map("delivery_terms") @db.Text
  remarks               String?  @db.Text
  status                String   @default("DRAFT") @db.VarChar(30)
  
  totalTaxable          Decimal  @default(0) @map("total_taxable") @db.Decimal(15, 2)
  totalGst              Decimal  @default(0) @map("total_gst") @db.Decimal(15, 2)
  grandTotal            Decimal  @default(0) @map("grand_total") @db.Decimal(15, 2)
  
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendor              Vendor?  @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  warehouse           Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  purchaseRequisition PurchaseRequisition? @relation(fields: [purchaseRequisitionId], references: [id], onDelete: SetNull)
  items               PurchaseQuotationItem[]
  purchaseOrders      PurchaseOrder[]

  @@unique([userId, quotationNo])
  @@index([userId])
  @@map("purchase_quotations")
}

model PurchaseQuotationItem {
  id                  Int      @id @default(autoincrement())
  purchaseQuotationId Int      @map("purchase_quotation_id")
  materialId          Int?     @map("material_id")
  materialName        String   @map("material_name") @db.VarChar(200)
  quantity            Decimal  @db.Decimal(15, 3)
  unit                String   @db.VarChar(50)
  rate                Decimal  @db.Decimal(15, 4)
  discount            Decimal  @default(0) @db.Decimal(15, 2)
  gstPercent          Decimal  @default(0) @map("gst_percent") @db.Decimal(6, 2)
  taxableAmount       Decimal  @default(0) @map("taxable_amount") @db.Decimal(15, 2)
  gstAmount           Decimal  @default(0) @map("gst_amount") @db.Decimal(15, 2)
  itemTotal           Decimal  @default(0) @map("item_total") @db.Decimal(15, 2)

  purchaseQuotation PurchaseQuotation @relation(fields: [purchaseQuotationId], references: [id], onDelete: Cascade)
  material          Material?         @relation(fields: [materialId], references: [id], onDelete: SetNull)

  @@index([purchaseQuotationId])
  @@map("purchase_quotation_items")
}

model PurchaseOrder {
  id                    Int      @id @default(autoincrement())
  userId                Int      @map("user_id")
  orderNo               String   @map("order_no") @db.VarChar(50)
  orderDate             DateTime @map("order_date") @db.Date
  vendorId              Int?     @map("vendor_id")
  vendorName            String   @map("vendor_name") @db.VarChar(200)
  warehouseId           Int?     @map("warehouse_id")
  purchaseRequisitionId Int?     @map("purchase_requisition_id")
  purchaseQuotationId   Int?     @map("purchase_quotation_id")
  expectedDeliveryDate  DateTime? @map("expected_delivery_date") @db.Date
  paymentTerms          String?  @map("payment_terms") @db.Text
  deliveryTerms         String?  @map("delivery_terms") @db.Text
  shippingAddress       String?  @map("shipping_address") @db.Text
  billingAddress        String?  @map("billing_address") @db.Text
  remarks               String?  @db.Text
  status                String   @default("DRAFT") @db.VarChar(30)

  totalTaxable          Decimal  @default(0) @map("total_taxable") @db.Decimal(15, 2)
  totalGst              Decimal  @default(0) @map("total_gst") @db.Decimal(15, 2)
  grandTotal            Decimal  @default(0) @map("grand_total") @db.Decimal(15, 2)
  
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendor              Vendor?  @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  warehouse           Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  purchaseRequisition PurchaseRequisition? @relation(fields: [purchaseRequisitionId], references: [id], onDelete: SetNull)
  purchaseQuotation   PurchaseQuotation? @relation(fields: [purchaseQuotationId], references: [id], onDelete: SetNull)
  
  items               PurchaseOrderItem[]
  goodsReceipts       GoodsReceipt[]
  purchases           Purchase[]

  @@unique([userId, orderNo])
  @@index([userId, orderDate, status])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id                  Int      @id @default(autoincrement())
  purchaseOrderId     Int      @map("purchase_order_id")
  materialId          Int?     @map("material_id")
  materialName        String   @map("material_name") @db.VarChar(200)
  orderedQty          Decimal  @map("ordered_qty") @db.Decimal(15, 3)
  receivedQty         Decimal  @default(0) @map("received_qty") @db.Decimal(15, 3)
  pendingQty          Decimal  @map("pending_qty") @db.Decimal(15, 3)
  unit                String   @db.VarChar(50)
  rate                Decimal  @db.Decimal(15, 4)
  discount            Decimal  @default(0) @db.Decimal(15, 2)
  gstPercent          Decimal  @default(0) @map("gst_percent") @db.Decimal(6, 2)
  taxableAmount       Decimal  @default(0) @map("taxable_amount") @db.Decimal(15, 2)
  gstAmount           Decimal  @default(0) @map("gst_amount") @db.Decimal(15, 2)
  itemTotal           Decimal  @default(0) @map("item_total") @db.Decimal(15, 2)
  warehouseId         Int?     @map("warehouse_id") // Line level warehouse override

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  material      Material?     @relation(fields: [materialId], references: [id], onDelete: Restrict)
  warehouse     Warehouse?    @relation(fields: [warehouseId], references: [id], onDelete: SetNull)

  @@index([purchaseOrderId, materialId])
  @@map("purchase_order_items")
}

model GoodsReceipt {
  id                  Int      @id @default(autoincrement())
  userId              Int      @map("user_id")
  grnNo               String   @map("grn_no") @db.VarChar(50)
  grnDate             DateTime @map("grn_date") @db.Date
  vendorId            Int?     @map("vendor_id")
  vendorName          String   @map("vendor_name") @db.VarChar(200)
  warehouseId         Int?     @map("warehouse_id")
  purchaseOrderId     Int?     @map("purchase_order_id")
  deliveryChallanNo   String?  @map("delivery_challan_no") @db.VarChar(100)
  transporter         String?  @db.VarChar(200)
  vehicleNo           String?  @map("vehicle_no") @db.VarChar(50)
  remarks             String?  @db.Text
  status              String   @default("DRAFT") @db.VarChar(30)

  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendor            Vendor?        @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  warehouse         Warehouse?     @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  purchaseOrder     PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)
  
  items             GoodsReceiptItem[]
  purchaseLinks     PurchaseGoodsReceipt[]

  @@unique([userId, grnNo])
  @@index([userId, grnDate, status])
  @@map("goods_receipts")
}

model GoodsReceiptItem {
  id                  Int      @id @default(autoincrement())
  goodsReceiptId      Int      @map("goods_receipt_id")
  materialId          Int?     @map("material_id")
  materialName        String   @map("material_name") @db.VarChar(200)
  orderedQty          Decimal  @default(0) @map("ordered_qty") @db.Decimal(15, 3)
  receivedQty         Decimal  @map("received_qty") @db.Decimal(15, 3)
  acceptedQty         Decimal  @map("accepted_qty") @db.Decimal(15, 3)
  rejectedQty         Decimal  @default(0) @map("rejected_qty") @db.Decimal(15, 3)
  unit                String   @db.VarChar(50)
  warehouseId         Int?     @map("warehouse_id")
  batchNo             String?  @map("batch_no") @db.VarChar(100)
  expiryDate          DateTime? @map("expiry_date") @db.Date
  remarks             String?  @db.Text
  
  purchaseOrderItemId Int?     @map("purchase_order_item_id")

  goodsReceipt GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  material     Material?    @relation(fields: [materialId], references: [id], onDelete: Restrict)
  warehouse    Warehouse?   @relation(fields: [warehouseId], references: [id], onDelete: Restrict)

  @@index([goodsReceiptId, materialId])
  @@map("goods_receipt_items")
}

model PurchaseGoodsReceipt {
  id             Int          @id @default(autoincrement())
  purchaseId     Int          @map("purchase_id")
  goodsReceiptId Int          @map("goods_receipt_id")
  
  purchase       Purchase     @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  goodsReceipt   GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Restrict)

  @@unique([purchaseId, goodsReceiptId])
  @@map("purchase_goods_receipts")
}
`;

// Add relations to User
schema = schema.replace('model User {', 'model User {\n  purchaseRequisitions PurchaseRequisition[]\n  purchaseQuotations PurchaseQuotation[]\n  purchaseOrders PurchaseOrder[]\n  goodsReceipts GoodsReceipt[]');

// Add relations to Vendor
schema = schema.replace('model Vendor {', 'model Vendor {\n  purchaseQuotations PurchaseQuotation[]\n  purchaseOrders PurchaseOrder[]\n  goodsReceipts GoodsReceipt[]');

// Add relations to Warehouse
schema = schema.replace('model Warehouse {', 'model Warehouse {\n  purchaseRequisitions PurchaseRequisition[]\n  purchaseQuotations PurchaseQuotation[]\n  purchaseOrders PurchaseOrder[]\n  purchaseOrderItems PurchaseOrderItem[]\n  goodsReceipts GoodsReceipt[]\n  goodsReceiptItems GoodsReceiptItem[]');

// Add relations to Material
schema = schema.replace('model Material {', 'model Material {\n  purchaseRequisitionItems PurchaseRequisitionItem[]\n  purchaseQuotationItems PurchaseQuotationItem[]\n  purchaseOrderItems PurchaseOrderItem[]\n  goodsReceiptItems GoodsReceiptItem[]');

// Add relations to Purchase
const purchaseRelationStr = `
  purchaseOrderId   Int?     @map("purchase_order_id")
  purchaseOrder     PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id], onDelete: SetNull)
  grnLinks          PurchaseGoodsReceipt[]
`;
schema = schema.replace('items             PurchaseItem[]', 'items             PurchaseItem[]\n' + purchaseRelationStr);


fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');

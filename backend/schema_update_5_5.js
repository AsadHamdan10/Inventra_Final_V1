const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema += `
// ==========================================
// PHASE 5.5: INVENTORY OPERATIONS
// ==========================================

model StockTransfer {
  id                     Int       @id @default(autoincrement())
  userId                 Int       @map("user_id")
  transferNo             String    @map("transfer_no") @db.VarChar(100)
  transferDate           DateTime  @map("transfer_date") @db.Date
  sourceWarehouseId      Int       @map("source_warehouse_id")
  destinationWarehouseId Int       @map("destination_warehouse_id")
  status                 String    @default("DRAFT") @db.VarChar(50)
  description            String?
  createdBy              Int       @map("created_by")
  postedBy               Int?      @map("posted_by")
  cancelledBy            Int?      @map("cancelled_by")
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  user                   User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceWarehouse        Warehouse @relation("TransferSource", fields: [sourceWarehouseId], references: [id], onDelete: Restrict)
  destinationWarehouse   Warehouse @relation("TransferDestination", fields: [destinationWarehouseId], references: [id], onDelete: Restrict)
  items                  StockTransferItem[]

  @@unique([userId, transferNo])
  @@map("stock_transfers")
}

model StockTransferItem {
  id              Int           @id @default(autoincrement())
  stockTransferId Int           @map("stock_transfer_id")
  materialId      Int           @map("material_id")
  quantity        Decimal       @db.Decimal(15, 6)
  actualCost      Decimal       @default(0) @map("actual_cost") @db.Decimal(15, 3)
  lineOrder       Int           @default(0) @map("line_order")

  stockTransfer   StockTransfer @relation(fields: [stockTransferId], references: [id], onDelete: Cascade)
  material        Material      @relation(fields: [materialId], references: [id], onDelete: Restrict)

  @@index([stockTransferId])
  @@map("stock_transfer_items")
}

model StockAdjustment {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  adjustmentNo    String    @map("adjustment_no") @db.VarChar(100)
  adjustmentDate  DateTime  @map("adjustment_date") @db.Date
  warehouseId     Int       @map("warehouse_id")
  status          String    @default("DRAFT") @db.VarChar(50)
  reason          String
  createdBy       Int       @map("created_by")
  postedBy        Int?      @map("posted_by")
  cancelledBy     Int?      @map("cancelled_by")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse       Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  items           StockAdjustmentItem[]

  @@unique([userId, adjustmentNo])
  @@map("stock_adjustments")
}

model StockAdjustmentItem {
  id                Int             @id @default(autoincrement())
  stockAdjustmentId Int             @map("stock_adjustment_id")
  materialId        Int             @map("material_id")
  adjustmentType    String          @map("adjustment_type") @db.VarChar(50) // INCREASE, DECREASE
  quantity          Decimal         @db.Decimal(15, 6)
  unitCost          Decimal         @default(0) @map("unit_cost") @db.Decimal(15, 3)

  stockAdjustment   StockAdjustment @relation(fields: [stockAdjustmentId], references: [id], onDelete: Cascade)
  material          Material        @relation(fields: [materialId], references: [id], onDelete: Restrict)

  @@index([stockAdjustmentId])
  @@map("stock_adjustment_items")
}
`;

// Inject reverse relations
schema = schema.replace('model User {', 'model User {\n  stockTransfers StockTransfer[]\n  stockAdjustments StockAdjustment[]');
schema = schema.replace('model Warehouse {', 'model Warehouse {\n  transfersOut StockTransfer[] @relation("TransferSource")\n  transfersIn StockTransfer[] @relation("TransferDestination")\n  stockAdjustments StockAdjustment[]');
schema = schema.replace('model Material {', 'model Material {\n  stockTransferItems StockTransferItem[]\n  stockAdjustmentItems StockAdjustmentItem[]');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated for 5.5');

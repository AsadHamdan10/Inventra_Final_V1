const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema += `
// ==========================================
// PHASE 5.4: PRODUCTION EXECUTION
// ==========================================

model ProductionExecution {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  productionOrderId Int      @map("production_order_id")
  executionNo       String   @map("execution_no") @db.VarChar(100)
  executionDate     DateTime @map("execution_date") @db.Date
  warehouseId       Int      @map("warehouse_id")
  status            String   @default("IN_PROGRESS") @db.VarChar(50)
  totalMaterialCost Decimal  @default(0) @map("total_material_cost") @db.Decimal(15, 3)
  totalFgCost       Decimal  @default(0) @map("total_fg_cost") @db.Decimal(15, 3)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  user              User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  productionOrder   ProductionOrder    @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  warehouse         Warehouse          @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  materialIssues    ProductionMaterialIssue[]
  outputs           ProductionOutput[]

  @@unique([userId, executionNo])
  @@index([productionOrderId])
  @@map("production_executions")
}

model ProductionMaterialIssue {
  id                    Int      @id @default(autoincrement())
  executionId           Int      @map("execution_id")
  componentItemId       Int      @map("component_item_id")
  warehouseId           Int      @map("warehouse_id")
  quantity              Decimal  @db.Decimal(15, 6)
  actualCost            Decimal  @default(0) @map("actual_cost") @db.Decimal(15, 3)
  inventoryLedgerOutId  Int?     @map("inventory_ledger_out_id")
  createdAt             DateTime @default(now()) @map("created_at")

  execution             ProductionExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  componentItem         Material            @relation("ProductionMaterialIssueItem", fields: [componentItemId], references: [id], onDelete: Restrict)
  warehouse             Warehouse           @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  inventoryLedgerOut    InventoryLedger?    @relation("ProductionMaterialIssueLedger", fields: [inventoryLedgerOutId], references: [id], onDelete: SetNull)

  @@index([executionId, componentItemId])
  @@map("production_material_issues")
}

model ProductionOutput {
  id                   Int      @id @default(autoincrement())
  executionId          Int      @map("execution_id")
  warehouseId          Int      @map("warehouse_id")
  quantity             Decimal  @db.Decimal(15, 6)
  actualCost           Decimal  @default(0) @map("actual_cost") @db.Decimal(15, 3)
  inventoryLedgerInId  Int?     @map("inventory_ledger_in_id")
  inventoryLayerId     Int?     @map("inventory_layer_id")
  createdAt            DateTime @default(now()) @map("created_at")

  execution            ProductionExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  warehouse            Warehouse           @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  inventoryLedgerIn    InventoryLedger?    @relation("ProductionOutputLedger", fields: [inventoryLedgerInId], references: [id], onDelete: SetNull)
  inventoryLayer       InventoryLayer?     @relation("ProductionOutputLayer", fields: [inventoryLayerId], references: [id], onDelete: SetNull)

  @@index([executionId])
  @@map("production_outputs")
}
`;

// Inject relation fields back into existing models
schema = schema.replace('model User {', 'model User {\n  productionExecutions ProductionExecution[]');
schema = schema.replace('model ProductionOrder {', 'model ProductionOrder {\n  executions ProductionExecution[]');
schema = schema.replace('model Warehouse {', 'model Warehouse {\n  productionExecutions ProductionExecution[]\n  productionMaterialIssues ProductionMaterialIssue[]\n  productionOutputs ProductionOutput[]');
schema = schema.replace('model Material {', 'model Material {\n  productionMaterialIssues ProductionMaterialIssue[] @relation("ProductionMaterialIssueItem")');
schema = schema.replace('model InventoryLedger {', 'model InventoryLedger {\n  productionMaterialIssues ProductionMaterialIssue[] @relation("ProductionMaterialIssueLedger")\n  productionOutputs ProductionOutput[] @relation("ProductionOutputLedger")');
schema = schema.replace('model InventoryLayer {', 'model InventoryLayer {\n  productionOutputs ProductionOutput[] @relation("ProductionOutputLayer")');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully for 5.4');

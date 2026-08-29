const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema += `
// ==========================================
// PHASE 5.3: CORE MANUFACTURING FOUNDATION
// ==========================================

model BillOfMaterial {
  id                 Int      @id @default(autoincrement())
  userId             Int      @map("user_id")
  bomCode            String   @map("bom_code") @db.VarChar(100)
  name               String   @db.VarChar(200)
  finishedGoodItemId Int      @map("finished_good_item_id")
  version            Int      @default(1)
  revision           String   @default("V1") @db.VarChar(50)
  status             String   @default("DRAFT") @db.VarChar(30)
  effectiveFrom      DateTime @map("effective_from") @db.Date
  effectiveTo        DateTime? @map("effective_to") @db.Date
  outputQuantity     Decimal  @default(1) @map("output_quantity") @db.Decimal(15, 3)
  outputUnit         String   @map("output_unit") @db.VarChar(50)
  notes              String?  @db.Text
  isDefault          Boolean  @default(false) @map("is_default")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  user             User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  finishedGoodItem Material             @relation("BomFinishedGood", fields: [finishedGoodItemId], references: [id], onDelete: Restrict)
  items            BillOfMaterialItem[]
  productionOrders ProductionOrder[]

  @@unique([userId, bomCode, revision])
  @@index([userId, finishedGoodItemId, status])
  @@map("bill_of_materials")
}

model BillOfMaterialItem {
  id              Int      @id @default(autoincrement())
  bomId           Int      @map("bom_id")
  componentItemId Int      @map("component_item_id")
  quantity        Decimal  @db.Decimal(15, 6) // Allow precision for micro components
  unit            String   @db.VarChar(50)
  scrapPercent    Decimal  @default(0) @map("scrap_percent") @db.Decimal(6, 2)
  sequence        Int      @default(0)
  warehouseId     Int?     @map("warehouse_id")
  notes           String?  @db.Text

  bom           BillOfMaterial @relation(fields: [bomId], references: [id], onDelete: Cascade)
  componentItem Material       @relation("BomComponent", fields: [componentItemId], references: [id], onDelete: Restrict)
  warehouse     Warehouse?     @relation(fields: [warehouseId], references: [id], onDelete: SetNull)

  @@index([bomId, componentItemId])
  @@map("bill_of_material_items")
}

model WorkCenter {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  code              String   @db.VarChar(50)
  name              String   @db.VarChar(200)
  description       String?  @db.Text
  workCenterType    String   @map("work_center_type") @db.VarChar(100)
  warehouseId       Int?     @map("warehouse_id")
  capacity          Decimal  @default(0) @db.Decimal(15, 2)
  capacityUnit      String?  @map("capacity_unit") @db.VarChar(50)
  efficiencyPercent Decimal  @default(100) @map("efficiency_percent") @db.Decimal(6, 2)
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  user              User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse         Warehouse?           @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  routingOperations RoutingOperation[]
  productionOrderOperations ProductionOrderOperation[]

  @@unique([userId, code])
  @@map("work_centers")
}

model Routing {
  id                 Int      @id @default(autoincrement())
  userId             Int      @map("user_id")
  code               String   @db.VarChar(100)
  name               String   @db.VarChar(200)
  finishedGoodItemId Int?     @map("finished_good_item_id")
  version            Int      @default(1)
  status             String   @default("DRAFT") @db.VarChar(30)
  effectiveFrom      DateTime @map("effective_from") @db.Date
  effectiveTo        DateTime? @map("effective_to") @db.Date
  notes              String?  @db.Text
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  finishedGoodItem Material?          @relation("RoutingFinishedGood", fields: [finishedGoodItemId], references: [id], onDelete: SetNull)
  operations       RoutingOperation[]
  productionOrders ProductionOrder[]

  @@unique([userId, code, version])
  @@index([userId, finishedGoodItemId, status])
  @@map("routings")
}

model RoutingOperation {
  id                Int      @id @default(autoincrement())
  routingId         Int      @map("routing_id")
  operationSequence Int      @map("operation_sequence")
  operationCode     String   @map("operation_code") @db.VarChar(100)
  operationName     String   @map("operation_name") @db.VarChar(200)
  workCenterId      Int      @map("work_center_id")
  setupTime         Decimal  @default(0) @map("setup_time") @db.Decimal(10, 2)
  runTime           Decimal  @default(0) @map("run_time") @db.Decimal(10, 2)
  queueTime         Decimal  @default(0) @map("queue_time") @db.Decimal(10, 2)
  moveTime          Decimal  @default(0) @map("move_time") @db.Decimal(10, 2)
  waitTime          Decimal  @default(0) @map("wait_time") @db.Decimal(10, 2)
  description       String?  @db.Text

  routing    Routing    @relation(fields: [routingId], references: [id], onDelete: Cascade)
  workCenter WorkCenter @relation(fields: [workCenterId], references: [id], onDelete: Restrict)

  @@unique([routingId, operationSequence])
  @@map("routing_operations")
}

model ProductionOrder {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  productionOrderNo String   @map("production_order_no") @db.VarChar(100)
  productionDate    DateTime @map("production_date") @db.Date
  itemId            Int      @map("item_id")
  plannedQuantity   Decimal  @map("planned_quantity") @db.Decimal(15, 3)
  completedQuantity Decimal  @default(0) @map("completed_quantity") @db.Decimal(15, 3)
  rejectedQuantity  Decimal  @default(0) @map("rejected_quantity") @db.Decimal(15, 3)
  warehouseId       Int      @map("warehouse_id")
  bomId             Int?     @map("bom_id")
  routingId         Int?     @map("routing_id")
  status            String   @default("DRAFT") @db.VarChar(30)
  priority          String   @default("NORMAL") @db.VarChar(30)
  plannedStartDate  DateTime? @map("planned_start_date") @db.Date
  plannedEndDate    DateTime? @map("planned_end_date") @db.Date
  actualStartDate   DateTime? @map("actual_start_date") @db.Date
  actualEndDate     DateTime? @map("actual_end_date") @db.Date
  notes             String?  @db.Text
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  item       Material   @relation("ProductionOrderItem", fields: [itemId], references: [id], onDelete: Restrict)
  warehouse  Warehouse  @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  bom        BillOfMaterial? @relation(fields: [bomId], references: [id], onDelete: Restrict)
  routing    Routing?   @relation(fields: [routingId], references: [id], onDelete: Restrict)

  components ProductionOrderComponent[]
  operations ProductionOrderOperation[]

  @@unique([userId, productionOrderNo])
  @@index([userId, productionDate, status])
  @@map("production_orders")
}

model ProductionOrderComponent {
  id                Int      @id @default(autoincrement())
  productionOrderId Int      @map("production_order_id")
  componentItemId   Int      @map("component_item_id")
  requiredQuantity  Decimal  @map("required_quantity") @db.Decimal(15, 6)
  issuedQuantity    Decimal  @default(0) @map("issued_quantity") @db.Decimal(15, 6)
  consumedQuantity  Decimal  @default(0) @map("consumed_quantity") @db.Decimal(15, 6)
  scrapPercent      Decimal  @default(0) @map("scrap_percent") @db.Decimal(6, 2)
  unit              String   @db.VarChar(50)
  warehouseId       Int?     @map("warehouse_id")

  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  componentItem   Material        @relation("ProductionOrderComponentItem", fields: [componentItemId], references: [id], onDelete: Restrict)
  warehouse       Warehouse?      @relation(fields: [warehouseId], references: [id], onDelete: SetNull)

  @@index([productionOrderId, componentItemId])
  @@map("production_order_components")
}

model ProductionOrderOperation {
  id                Int      @id @default(autoincrement())
  productionOrderId Int      @map("production_order_id")
  operationSequence Int      @map("operation_sequence")
  operationCode     String   @map("operation_code") @db.VarChar(100)
  operationName     String   @map("operation_name") @db.VarChar(200)
  workCenterId      Int      @map("work_center_id")
  status            String   @default("PENDING") @db.VarChar(30)
  setupTime         Decimal  @default(0) @map("setup_time") @db.Decimal(10, 2)
  runTime           Decimal  @default(0) @map("run_time") @db.Decimal(10, 2)

  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  workCenter      WorkCenter      @relation(fields: [workCenterId], references: [id], onDelete: Restrict)

  @@unique([productionOrderId, operationSequence])
  @@map("production_order_operations")
}
`;

// Add relations to existing models
schema = schema.replace('model User {', 'model User {\n  boms BillOfMaterial[]\n  workCenters WorkCenter[]\n  routings Routing[]\n  productionOrders ProductionOrder[]');
schema = schema.replace('model Warehouse {', 'model Warehouse {\n  bomItems BillOfMaterialItem[]\n  workCenters WorkCenter[]\n  productionOrders ProductionOrder[]\n  productionOrderComponents ProductionOrderComponent[]');
schema = schema.replace('model Material {', 'model Material {\n  finishedGoodBoms BillOfMaterial[] @relation("BomFinishedGood")\n  componentBoms BillOfMaterialItem[] @relation("BomComponent")\n  finishedGoodRoutings Routing[] @relation("RoutingFinishedGood")\n  productionOrders ProductionOrder[] @relation("ProductionOrderItem")\n  productionOrderComponents ProductionOrderComponent[] @relation("ProductionOrderComponentItem")');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');

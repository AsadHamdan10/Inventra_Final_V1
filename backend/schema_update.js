const fs = require('fs');
let schema = fs.readFileSync('prisma/schema_backup.prisma', 'utf8');

// Add enums
schema += '\n\n// Phase 5.1 Additions\n\n';
schema += 'enum BusinessType {\n  TRADING\n  MANUFACTURING\n  BOTH\n}\n\n';
schema += 'enum ItemType {\n  TRADING_GOOD\n  RAW_MATERIAL\n  SEMI_FINISHED_GOOD\n  FINISHED_GOOD\n  SERVICE\n}\n\n';
schema += 'enum WarehouseType {\n  GENERAL\n  RAW_MATERIAL\n  PRODUCTION\n  FINISHED_GOODS\n  REJECTED\n  QUARANTINE\n}\n\n';

// Add new models
schema += `model TenantConfiguration {
  id                 Int          @id @default(autoincrement())
  userId             Int          @unique @map("user_id")
  businessType       BusinessType @default(TRADING) @map("business_type")
  enabledModules     String       @default("[]") @map("enabled_modules")
  defaultWarehouseId Int?         @map("default_warehouse_id")
  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @updatedAt @map("updated_at")

  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  defaultWarehouse Warehouse? @relation(fields: [defaultWarehouseId], references: [id], onDelete: SetNull)

  @@map("tenant_configurations")
}

model ItemCategory {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  code        String   @db.VarChar(50)
  name        String   @db.VarChar(100)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  materials Material[]

  @@unique([userId, code])
  @@index([userId])
  @@map("item_categories")
}

model Warehouse {
  id            Int           @id @default(autoincrement())
  userId        Int           @map("user_id")
  code          String        @db.VarChar(50)
  name          String        @db.VarChar(100)
  description   String?       @db.Text
  address       String?       @db.Text
  city          String?       @db.VarChar(100)
  state         String?       @db.VarChar(100)
  pincode       String?       @db.VarChar(20)
  warehouseType WarehouseType @default(GENERAL) @map("warehouse_type")
  isActive      Boolean       @default(true) @map("is_active")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  user             User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantConfigs    TenantConfiguration[]
  inventoryLayers  InventoryLayer[]
  inventoryLedgers InventoryLedger[]

  @@unique([userId, code])
  @@index([userId])
  @@map("warehouses")
}
`;

// Add relations to User
schema = schema.replace('model User {', 'model User {\n  tenantConfig TenantConfiguration?\n  itemCategories ItemCategory[]\n  warehouses Warehouse[]');

// Modify Material
const materialReplacement = `
    itemCode           String?       @map("item_code") @db.VarChar(50)
    itemType           ItemType      @default(TRADING_GOOD) @map("item_type")
    categoryId         Int?          @map("category_id")
    description        String?       @db.Text
    inventoryTracked   Boolean       @default(true) @map("inventory_tracked")
    purchaseEnabled    Boolean       @default(true) @map("purchase_enabled")
    salesEnabled       Boolean       @default(true) @map("sales_enabled")
    standardPrice      Decimal?      @db.Decimal(15, 2) @map("standard_price")
    standardCost       Decimal?      @db.Decimal(15, 2) @map("standard_cost")
    gstRate            Decimal?      @db.Decimal(5, 2) @map("gst_rate")
    taxability         String        @default("TAXABLE") @db.VarChar(30)
    batchReady         Boolean       @default(false) @map("batch_ready")
    expiryReady        Boolean       @default(false) @map("expiry_ready")
    category           ItemCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
`;
schema = schema.replace('@@index([userId])\n  @@map("materials")', '@@index([userId])\n  @@unique([userId, itemCode])\n  @@map("materials")');
schema = schema.replace('isActive             Boolean               @default(true) @map("is_active")', 'isActive             Boolean               @default(true) @map("is_active")\n' + materialReplacement);

// Modify InventoryLayer
schema = schema.replace('material          Material?          @relation(fields: [materialId], references: [id])', 'material          Material?          @relation(fields: [materialId], references: [id])\n  warehouseId Int? @map("warehouse_id")\n  warehouse Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: Restrict)');

// Modify InventoryLedger
schema = schema.replace('material          Material? @relation(fields: [materialId], references: [id])', 'material          Material? @relation(fields: [materialId], references: [id])\n  warehouseId Int? @map("warehouse_id")\n  warehouse Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: Restrict)');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');

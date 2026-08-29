import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

if (!content.includes('model InventoryLayer')) {
  const models = `

model InventoryLayer {
  id               Int      @id @default(autoincrement())
  userId           Int      @map("user_id")
  materialId       Int      @map("material_id")
  
  sourceType       String   @db.VarChar(50) // PURCHASE, OPENING, ADJUSTMENT_IN
  sourceId         Int?     @map("source_id")
  
  receivedDate     DateTime @map("received_date") @db.Date
  
  originalQty      Decimal  @map("original_qty") @db.Decimal(15, 3)
  remainingQty     Decimal  @map("remaining_qty") @db.Decimal(15, 3)
  
  unitCostEnc      String   @map("unit_cost_enc") @db.Text

  material         Material @relation(fields: [materialId], references: [id], onDelete: Restrict)
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  consumptions     LayerConsumption[]

  @@index([userId, materialId, remainingQty, receivedDate, id])
  @@map("inventory_layers")
}

model LayerConsumption {
  id               Int      @id @default(autoincrement())
  userId           Int      @map("user_id")
  layerId          Int      @map("layer_id")
  saleItemId       Int      @map("sale_item_id")
  
  quantityConsumed Decimal  @map("quantity_consumed") @db.Decimal(15, 3)
  unitCostEnc      String   @map("unit_cost_enc") @db.Text

  layer            InventoryLayer @relation(fields: [layerId], references: [id], onDelete: Restrict)
  saleItem         SaleItem       @relation(fields: [saleItemId], references: [id], onDelete: Cascade)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, saleItemId])
  @@index([userId, layerId])
  @@map("layer_consumptions")
}
`;
  content += models;
  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log('Added InventoryLayer and LayerConsumption to schema');
} else {
  console.log('Schema already has models');
}

// I also need to make sure SaleItem has layerConsumptions array
if (!content.includes('layerConsumptions LayerConsumption[]')) {
    content = content.replace(
        /sale Sale @relation\(fields: \[saleId\], references: \[id\], onDelete: Cascade\)/g,
        'sale Sale @relation(fields: [saleId], references: [id], onDelete: Cascade)\n  layerConsumptions LayerConsumption[]'
    );
    fs.writeFileSync(schemaPath, content, 'utf8');
}

const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace('saleItemId       Int            @map("sale_item_id")', 'saleItemId       Int?           @map("sale_item_id")');
schema = schema.replace('saleItem         SaleItem       @relation(fields: [saleItemId], references: [id], onDelete: Cascade)', 'saleItem         SaleItem?      @relation(fields: [saleItemId], references: [id], onDelete: Cascade)');

schema = schema.replace('model LayerConsumption {', 'model LayerConsumption {\n  productionMaterialIssueId Int? @map("production_material_issue_id")\n  productionMaterialIssue ProductionMaterialIssue? @relation(fields: [productionMaterialIssueId], references: [id], onDelete: Cascade)');

schema = schema.replace('model ProductionMaterialIssue {', 'model ProductionMaterialIssue {\n  layerConsumptions LayerConsumption[]');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema LayerConsumption updated');

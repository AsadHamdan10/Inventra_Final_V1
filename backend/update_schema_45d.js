const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add rcm and itcEligibility to Purchase if not exists
if (!schema.includes('rcm Boolean')) {
    schema = schema.replace(
        /totalGst\s+Decimal\s+@default\(0\)\s+@map\(\"total_gst\"\)\s+@db\.Decimal\(15, 2\)/,
        `totalGst          Decimal                   @default(0) @map("total_gst") @db.Decimal(15, 2)\n    rcm               Boolean                   @default(false)\n    itcEligibility    String                    @default("ELIGIBLE") @db.VarChar(30)`
    );
}

// Add GstReturn model if not exists
if (!schema.includes('model GstReturn')) {
    schema += `
model GstReturn {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  returnType      String   @map("return_type") @db.VarChar(20)
  periodMonth     Int      @map("period_month")
  periodYear      Int      @map("period_year")
  status          String   @default("DRAFT") @db.VarChar(30)

  payload         String?  @db.Text
  snapshotHash    String?  @map("snapshot_hash") @db.VarChar(64)

  ackNo           String?  @map("ack_no") @db.VarChar(50)
  filedAt         DateTime? @map("filed_at")

  errorDetails    String?  @map("error_details") @db.Text

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, returnType, periodMonth, periodYear])
  @@index([userId])
  @@index([userId, periodYear, periodMonth])
  @@index([status])
  @@map("gst_returns")
}
`;
    // Add relation to User
    schema = schema.replace(/vendorPayments\s+VendorPayment\[\]/, `vendorPayments    VendorPayment[]\n    gstReturns        GstReturn[]`);
}

// Add composite indexes for Sale, Purchase, SalesReturn if not exists
if (!schema.includes('@@index([userId, invoiceDate, status])')) {
    schema = schema.replace(/@@map\(\"sales\"\)/, '@@index([userId, invoiceDate, status])\n  @@map("sales")');
}
if (!schema.includes('@@index([userId, billDate, status])')) {
    schema = schema.replace(/@@map\(\"purchases\"\)/, '@@index([userId, billDate, status])\n  @@map("purchases")');
}
if (!schema.includes('@@index([userId, returnDate, status])')) {
    schema = schema.replace(/@@map\(\"sales_returns\"\)/, '@@index([userId, returnDate, status])\n  @@map("sales_returns")');
}

fs.writeFileSync('prisma/schema.prisma', schema);

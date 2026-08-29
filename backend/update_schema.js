const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add model EWayBill
if (!schema.includes('model EWayBill')) {
  schema += `
model EWayBill {
  id                    Int      @id @default(autoincrement())
  userId                Int      @map("user_id")

  saleId                Int?     @unique @map("sale_id")
  salesReturnId         Int?     @unique @map("sales_return_id")
  deliveryChallanId     Int?     @unique @map("delivery_challan_id")

  ewbNo                 String?  @unique @map("ewb_no") @db.VarChar(30)

  status                String   @default("NOT_GENERATED") @db.VarChar(50)

  documentType          String?  @map("document_type") @db.VarChar(30)
  documentNo            String?  @map("document_no") @db.VarChar(100)
  documentDate          DateTime? @map("document_date")

  supplyType            String?  @map("supply_type") @db.VarChar(30)
  subSupplyType         String?  @map("sub_supply_type") @db.VarChar(50)
  subSupplyDescription  String?  @map("sub_supply_description") @db.VarChar(500)

  transporterId         String?  @map("transporter_id") @db.VarChar(50)
  transporterName       String?  @map("transporter_name") @db.VarChar(200)

  transportMode         String?  @map("transport_mode") @db.VarChar(30)
  transportDocNo        String?  @map("transport_doc_no") @db.VarChar(100)
  transportDocDate      DateTime? @map("transport_doc_date")

  vehicleNo             String?  @map("vehicle_no") @db.VarChar(50)
  vehicleType           String?  @map("vehicle_type") @db.VarChar(20)

  fromPlace             String?  @map("from_place") @db.VarChar(200)
  fromState             String?  @map("from_state") @db.VarChar(100)
  fromPincode           String?  @map("from_pincode") @db.VarChar(20)

  toPlace               String?  @map("to_place") @db.VarChar(200)
  toState               String?  @map("to_state") @db.VarChar(100)
  toPincode             String?  @map("to_pincode") @db.VarChar(20)

  approximateDistance   Int?     @map("approx_distance")

  validFrom             DateTime? @map("valid_from")
  validUntil            DateTime? @map("valid_until")

  cancelledAt           DateTime? @map("cancelled_at")
  cancelReason          String?  @map("cancel_reason") @db.Text

  extendedAt            DateTime? @map("extended_at")
  extensionReason      String?  @map("extension_reason") @db.Text

  payload               String?  @db.Text
  responsePayload       String?  @map("response_payload") @db.Text
  errorDetails          String?  @map("error_details") @db.Text

  isMock                Boolean  @default(true) @map("is_mock")

  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  user                  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  sale                  Sale? @relation(fields: [saleId], references: [id], onDelete: Restrict)
  salesReturn           SalesReturn? @relation(fields: [salesReturnId], references: [id], onDelete: Restrict)
  deliveryChallan       DeliveryChallan? @relation(fields: [deliveryChallanId], references: [id], onDelete: Restrict)

  @@index([userId])
  @@index([status])
  @@index([saleId])
  @@index([salesReturnId])
  @@index([deliveryChallanId])
  @@index([documentDate])
  @@map("e_way_bills")
}
`;
}

// Add relations
schema = schema.replace(/eInvoices\s+EInvoice\[\]/g, 'eInvoices EInvoice[]\n    eWayBills EWayBill[]');
schema = schema.replace(/eInvoice\s+EInvoice\?/g, 'eInvoice EInvoice?\n    eWayBill EWayBill?');
if (schema.indexOf('eWayBill EWayBill?') === schema.lastIndexOf('eWayBill EWayBill?')) {
    // If it only replaced once (Sale), add for SalesReturn and DeliveryChallan
    schema = schema.replace(/@@map\(\"sales_returns\"\)/g, 'eWayBill EWayBill?\n    @@map("sales_returns")');
    schema = schema.replace(/@@map\(\"delivery_challans\"\)/g, 'eWayBill EWayBill?\n    @@map("delivery_challans")');
}
fs.writeFileSync('prisma/schema.prisma', schema);


const fs = require("fs");
let schema = fs.readFileSync("backend/prisma/schema.prisma", "utf8");

const saasModels = `
// ==========================================
// SAAS PLATFORM BILLING (PHASE 6.9)
// ==========================================

model SaaSPlan {
  id              Int       @id @default(autoincrement())
  code            String    @unique @db.VarChar(50)
  name            String    @db.VarChar(100)
  description     String?   @db.Text
  annualPrice     Decimal   @map("annual_price") @db.Decimal(15, 2)
  currency        String    @default("INR") @db.VarChar(10)
  businessType    String    @map("business_type") @db.VarChar(50) // e.g., TRADING, TRADING_MANUFACTURING
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  subscriptions   SaaSSubscription[]

  @@map("saas_plans")
}

model SaaSSubscription {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  planId          Int       @map("plan_id")
  status          String    @default("PENDING") @db.VarChar(30) // PENDING, ACTIVE, EXPIRED, CANCELLED
  startDate       DateTime  @map("start_date") @db.Date
  endDate         DateTime  @map("end_date") @db.Date
  listPrice       Decimal   @map("list_price") @db.Decimal(15, 2) // Snapshotted list price
  discountAmount  Decimal   @default(0) @map("discount_amount") @db.Decimal(15, 2)
  finalAmount     Decimal   @map("final_amount") @db.Decimal(15, 2)
  notes           String?   @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  user            User      @relation(fields: [userId], references: [id])
  plan            SaaSPlan  @relation(fields: [planId], references: [id])
  payments        SaaSPayment[]
  
  @@map("saas_subscriptions")
}

model SaaSPayment {
  id                    Int       @id @default(autoincrement())
  subscriptionId        Int       @map("subscription_id")
  userId                Int       @map("user_id")
  amountReceived        Decimal   @map("amount_received") @db.Decimal(15, 2)
  paymentDate           DateTime  @map("payment_date") @db.Date
  paymentMethod         String    @db.VarChar(50) // CASH, BANK_TRANSFER, UPI, CHEQUE, OTHER
  transactionReference  String?   @map("transaction_reference") @db.VarChar(100)
  receiptNumber         String?   @map("receipt_number") @db.VarChar(100)
  notes                 String?   @db.Text
  recordedBy            Int       @map("recorded_by")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  subscription          SaaSSubscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  user                  User              @relation("SaaSPayments", fields: [userId], references: [id])
  recordedByUser        User              @relation("RecordedPayments", fields: [recordedBy], references: [id])
  commissions           SaaSCommission[]

  @@map("saas_payments")
}

model SaaSCommission {
  id                  Int       @id @default(autoincrement())
  paymentId           Int       @map("payment_id")
  marketerName        String    @map("marketer_name") @db.VarChar(150)
  commissionAmount    Decimal   @map("commission_amount") @db.Decimal(15, 2)
  notes               String?   @db.Text
  createdAt           DateTime  @default(now()) @map("created_at")

  payment             SaaSPayment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@map("saas_commissions")
}
`;

// Inject relation fields into User model
const userRelations = `
  saasSubscriptions                                 SaaSSubscription[]
  saasPayments                                      SaaSPayment[] @relation("SaaSPayments")
  recordedSaaSPayments                              SaaSPayment[] @relation("RecordedPayments")
`;

schema = schema.replace(/(model User \{[^]*?)(?=^\})/m, "$1" + userRelations + "\n");
schema += "\n" + saasModels;

fs.writeFileSync("backend/prisma/schema.prisma", schema, "utf8");
console.log("Schema patched successfully.");


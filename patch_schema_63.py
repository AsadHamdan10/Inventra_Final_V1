
import re

with open("backend/prisma/schema.prisma", "r") as f:
    data = f.read()

# Add ApplicationSnapshot if not exists
if "model ApplicationSnapshot" not in data:
    snapshot_model = """
model ApplicationSnapshot {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique @map("user_id")
  applicationRef  String    @unique @map("application_ref") @db.VarChar(50)
  fullName        String?   @map("full_name") @db.VarChar(150)
  companyName     String    @map("company_name") @db.VarChar(200)
  username        String    @db.VarChar(100)
  email           String    @db.VarChar(150)
  mobile          String?
  businessType    String?   @map("business_type") @db.VarChar(50)
  industry        String?   @db.VarChar(100)
  plan            String    @default("V1_BASIC") @db.VarChar(50)
  billingCycle    String?   @map("billing_cycle") @db.VarChar(20)
  originalStatus  String?   @map("original_status") @db.VarChar(50)
  rejectionReason String?   @map("rejection_reason") @db.Text
  submittedAt     DateTime  @default(now()) @map("submitted_at")
  reviewedAt      DateTime? @map("reviewed_at")
  reviewedBy      Int?      @map("reviewed_by")

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("application_snapshots")
}
"""
    data += snapshot_model
    
    # Add relation to User model
    data = data.replace(
        "activationTokens                                  ActivationToken[]",
        "activationTokens                                  ActivationToken[]\n  applicationSnapshot                               ApplicationSnapshot?"
    )

# Add extra profile fields to User
if "legalName" not in data:
    data = data.replace(
        "companyName                                       String                      @map(\"company_name\") @db.VarChar(200)",
        "companyName                                       String                      @map(\"company_name\") @db.VarChar(200)\n  legalName                                         String?                     @map(\"legal_name\") @db.VarChar(200)\n  tradingName                                       String?                     @map(\"trading_name\") @db.VarChar(200)\n  website                                           String?                     @db.VarChar(255)\n  description                                       String?                     @db.Text\n  alternatePhone                                    String?                     @map(\"alternate_phone\")\n  contactPerson                                     String?                     @map(\"contact_person\") @db.VarChar(150)\n  currency                                          String                      @default(\"INR\") @db.VarChar(10)\n  timezone                                          String                      @default(\"Asia/Kolkata\") @db.VarChar(50)\n  dateFormat                                        String                      @default(\"DD/MM/YYYY\") @map(\"date_format\") @db.VarChar(20)\n  numberFormat                                      String                      @default(\"en-IN\") @map(\"number_format\") @db.VarChar(20)"
    )

with open("backend/prisma/schema.prisma", "w") as f:
    f.write(data)


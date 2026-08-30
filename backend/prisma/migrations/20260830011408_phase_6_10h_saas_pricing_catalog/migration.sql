-- AlterTable
ALTER TABLE "saas_plans" ADD COLUMN     "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "display_name" VARCHAR(150),
ADD COLUMN     "duration_months" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "final_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "included_users" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "list_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "platform_access" VARCHAR(20) NOT NULL DEFAULT 'DESKTOP',
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "saas_subscriptions" ADD COLUMN     "duration_months" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "included_users" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "platform_access" VARCHAR(20) NOT NULL DEFAULT 'DESKTOP',
ADD COLUMN     "renewed_from_subscription_id" INTEGER;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_renewed_from_subscription_id_fkey" FOREIGN KEY ("renewed_from_subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

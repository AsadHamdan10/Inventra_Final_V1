
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Phase 6.10H: this seed remains the ONLY place the original ₹3,499 / ₹4,699
// commercial values are hardcoded anywhere in the system. It exists purely to
// preserve today's live pricing as the initial catalog rows; from here on,
// Super Admin changes prices through the Products & Pricing admin screen
// (PlanController), never by re-running or editing this script.
async function run() {
    try {
        await prisma.saaSPlan.upsert({
            where: { code: "TRADING_ANNUAL" },
            update: {
                annualPrice: 3499, listPrice: 3499, discountAmount: 0, finalPrice: 3499,
                name: "Trading ERP", displayName: "Trading Annual",
                description: "Supports Trading functionality", businessType: "TRADING",
                platformAccess: "DESKTOP", durationMonths: 12, includedUsers: 5,
                status: "ACTIVE", isActive: true,
            },
            create: {
                code: "TRADING_ANNUAL",
                annualPrice: 3499, listPrice: 3499, discountAmount: 0, finalPrice: 3499,
                name: "Trading ERP", displayName: "Trading Annual",
                description: "Supports Trading functionality", businessType: "TRADING",
                platformAccess: "DESKTOP", durationMonths: 12, includedUsers: 5,
                status: "ACTIVE", isActive: true, currency: "INR",
            }
        });
        await prisma.saaSPlan.upsert({
            where: { code: "TRADING_MANUFACTURING_ANNUAL" },
            update: {
                annualPrice: 4699, listPrice: 4699, discountAmount: 0, finalPrice: 4699,
                name: "Trading + Manufacturing ERP", displayName: "Trading + Manufacturing Annual",
                description: "Supports Trading + Manufacturing functionality", businessType: "BOTH",
                platformAccess: "DESKTOP", durationMonths: 12, includedUsers: 5,
                status: "ACTIVE", isActive: true,
            },
            create: {
                code: "TRADING_MANUFACTURING_ANNUAL",
                annualPrice: 4699, listPrice: 4699, discountAmount: 0, finalPrice: 4699,
                name: "Trading + Manufacturing ERP", displayName: "Trading + Manufacturing Annual",
                description: "Supports Trading + Manufacturing functionality", businessType: "BOTH",
                platformAccess: "DESKTOP", durationMonths: 12, includedUsers: 5,
                status: "ACTIVE", isActive: true, currency: "INR",
            }
        });
        console.log("SaaS Plans seeded successfully.");
    } catch(e) { console.error(e); } finally { await prisma.$disconnect(); }
}
run();

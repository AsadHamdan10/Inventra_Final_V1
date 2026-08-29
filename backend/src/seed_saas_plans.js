
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
    try {
        await prisma.saaSPlan.upsert({
            where: { code: "TRADING_ANNUAL" },
            update: { annualPrice: 3499, name: "Trading ERP", description: "Supports Trading functionality", businessType: "TRADING" },
            create: { code: "TRADING_ANNUAL", annualPrice: 3499, name: "Trading ERP", description: "Supports Trading functionality", businessType: "TRADING", currency: "INR" }
        });
        await prisma.saaSPlan.upsert({
            where: { code: "TRADING_MANUFACTURING_ANNUAL" },
            update: { annualPrice: 4699, name: "Trading + Manufacturing ERP", description: "Supports Trading + Manufacturing functionality", businessType: "TRADING_MANUFACTURING" },
            create: { code: "TRADING_MANUFACTURING_ANNUAL", annualPrice: 4699, name: "Trading + Manufacturing ERP", description: "Supports Trading + Manufacturing functionality", businessType: "TRADING_MANUFACTURING", currency: "INR" }
        });
        console.log("SaaS Plans seeded successfully.");
    } catch(e) { console.error(e); } finally { await prisma.$disconnect(); }
}
run();


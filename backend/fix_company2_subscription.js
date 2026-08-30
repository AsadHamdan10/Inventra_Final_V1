// One-off correction script — Phase 6.10H bug fix.
//
// Root cause (now fixed in adminController.approveApplication): approving an
// application always assigned the hardcoded legacy plan (TRADING_ANNUAL /
// TRADING_MANUFACTURING_ANNUAL) instead of the specific plan the applicant
// actually selected at registration. Any application approved BEFORE this fix
// may be carrying the wrong plan/price. This script corrects one such tenant.
//
// Run this from your own Windows terminal (not the device bridge), from the
// backend/ folder:
//   node fix_company2_subscription.js
//
// Edit the two constants below first if your case differs.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USER_ID = 2;                          // the tenant (applicationRef #2) to correct
const CORRECT_PLAN_CODE = 'TRADING_ANNUAL_MOBILE'; // the plan they actually selected/paid for

async function main() {
  const plan = await prisma.saaSPlan.findUnique({ where: { code: CORRECT_PLAN_CODE } });
  if (!plan) throw new Error(`Plan ${CORRECT_PLAN_CODE} not found — check the code in Products & Pricing.`);

  const sub = await prisma.saaSSubscription.findFirst({
    where: { userId: USER_ID, status: { not: 'CANCELLED' } },
    orderBy: { id: 'desc' },
  });
  if (!sub) throw new Error(`No active subscription found for user ${USER_ID}.`);

  const listPrice = Number(plan.listPrice || plan.annualPrice);
  const discountAmount = Number(plan.discountAmount || 0);
  const finalAmount = Math.max(0, listPrice - discountAmount);

  const startDate = new Date(sub.startDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + plan.durationMonths);
  endDate.setDate(endDate.getDate() - 1);

  await prisma.$transaction([
    prisma.saaSSubscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        listPrice,
        discountAmount,
        finalAmount,
        platformAccess: plan.platformAccess,
        durationMonths: plan.durationMonths,
        includedUsers: plan.includedUsers,
        endDate,
        notes: `${sub.notes || ''} | Corrected to ${plan.code} (Phase 6.10H approval-plan bug fix).`.trim(),
      },
    }),
    prisma.user.update({
      where: { id: USER_ID },
      data: { plan: plan.code, subscriptionEnd: endDate },
    }),
  ]);

  console.log(`Corrected user ${USER_ID}'s subscription to ${plan.code} — final amount now ₹${finalAmount}, ends ${endDate.toDateString()}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

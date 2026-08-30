// One-off backfill — Phase 6.10H bug fix.
//
// Root cause (now fixed in adminController.approveApplication): nothing ever
// wrote TenantConfiguration.businessType from a tenant's approved plan, so it
// silently defaulted to TRADING for every tenant, and requireManufacturingEntitlement
// could never let a legitimate Trading + Manufacturing tenant through. The fix
// only takes effect for applications approved from now on — any tenant
// approved BEFORE this fix needs its TenantConfiguration corrected once, which
// is what this script does, for every such tenant in one pass.
//
// Run this from your own Windows terminal (not the device bridge), from the
// backend/ folder, AFTER pulling the latest backend changes:
//   node backfill_tenant_business_type.js
//
// Safe to run more than once (idempotent upsert).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.user.findMany({
    where: {
      role: { not: 'super_admin' },
      status: { in: ['activation_pending', 'active'] },
    },
    select: { id: true, companyName: true, plan: true, applicationRef: true },
  });

  console.log(`Found ${tenants.length} approved tenant(s) to check.`);

  let updated = 0, skipped = 0;

  for (const tenant of tenants) {
    if (!tenant.plan) {
      console.log(`  #${tenant.applicationRef || tenant.id} (${tenant.companyName}): no plan code on record, skipping.`);
      skipped++;
      continue;
    }

    const plan = await prisma.saaSPlan.findUnique({ where: { code: tenant.plan } });
    if (!plan) {
      console.log(`  #${tenant.applicationRef || tenant.id} (${tenant.companyName}): plan code "${tenant.plan}" not found in catalog, skipping.`);
      skipped++;
      continue;
    }

    const businessType = plan.businessType === 'BOTH' ? 'BOTH' : 'TRADING';
    const existing = await prisma.tenantConfiguration.findUnique({ where: { userId: tenant.id } });

    if (existing && existing.businessType === businessType) {
      continue; // already correct
    }

    await prisma.tenantConfiguration.upsert({
      where: { userId: tenant.id },
      create: {
        userId: tenant.id,
        businessType,
        enabledModules: JSON.stringify(
          businessType === 'BOTH'
            ? ['TRADING', 'MANUFACTURING', 'INVENTORY', 'ACCOUNTING']
            : ['TRADING', 'INVENTORY', 'ACCOUNTING']
        ),
      },
      update: { businessType },
    });

    console.log(`  #${tenant.applicationRef || tenant.id} (${tenant.companyName}): set to ${businessType} (plan ${plan.code}).`);
    updated++;
  }

  console.log(`\nDone. ${updated} corrected, ${skipped} skipped, ${tenants.length - updated - skipped} already correct.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

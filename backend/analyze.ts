import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyze() {
  const materials = await prisma.material.findMany();
  const saleItems = await prisma.saleItem.findMany({ include: { sale: true } });
  const purchaseItems = await prisma.purchaseItem.findMany({ include: { purchase: true } });

  console.log('--- Material Count ---');
  console.log(`Total Materials: ${materials.length}`);
  console.log(`Total Sale Items: ${saleItems.length}`);
  console.log(`Total Purchase Items: ${purchaseItems.length}`);

  const materialNames = new Set(materials.map(m => m.materialName));
  const materialNameLower = new Map();
  const duplicates = [];

  for (const m of materials) {
      const lower = m.materialName.toLowerCase();
      if (materialNameLower.has(lower) && materialNameLower.get(lower) !== m.materialName) {
          duplicates.push({ name1: materialNameLower.get(lower), name2: m.materialName });
      }
      materialNameLower.set(lower, m.materialName);
  }

  console.log('\n--- Duplicates (Case Insensitive) ---');
  console.log(duplicates);

  const orphanedSales = [];
  for (const si of saleItems) {
      const match = materials.find(m => m.materialName === si.materialName && m.userId === si.sale.userId);
      if (!match) {
          orphanedSales.push({ id: si.id, name: si.materialName, userId: si.sale.userId });
      }
  }

  const orphanedPurchases = [];
  for (const pi of purchaseItems) {
      const match = materials.find(m => m.materialName === pi.materialName && m.userId === pi.purchase.userId);
      if (!match) {
          orphanedPurchases.push({ id: pi.id, name: pi.materialName, userId: pi.purchase.userId });
      }
  }

  console.log('\n--- Orphaned Items (Name changed or deleted) ---');
  console.log(`Orphaned Sale Items: ${orphanedSales.length}`);
  if (orphanedSales.length > 0) console.log(orphanedSales.slice(0, 5));
  console.log(`Orphaned Purchase Items: ${orphanedPurchases.length}`);
  if (orphanedPurchases.length > 0) console.log(orphanedPurchases.slice(0, 5));

  console.log('\n--- Mismatched Case Items ---');
  const caseMismatchedSales = [];
  for (const si of saleItems) {
      if (orphanedSales.find(o => o.id === si.id)) {
          const matchLower = materials.find(m => m.materialName.toLowerCase() === si.materialName.toLowerCase() && m.userId === si.sale.userId);
          if (matchLower) caseMismatchedSales.push({ id: si.id, original: si.materialName, matchesTo: matchLower.materialName });
      }
  }
  console.log(`Case Mismatched Sales: ${caseMismatchedSales.length}`);

}

analyze().catch(console.error).finally(() => prisma.$disconnect());

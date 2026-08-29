
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkDB() {
  const journals = await prisma.journalEntry.findMany({ include: { lines: true } });
  let unbalanced = 0;
  for(let j of journals) {
    let dr = 0, cr = 0;
    for(let l of j.lines) {
      dr += Number(l.debit);
      cr += Number(l.credit);
    }
    if (Math.abs(dr - cr) > 0.01) {
      unbalanced++;
      console.log(`Unbalanced Journal: ${j.journalNo} (Dr: ${dr}, Cr: ${cr})`);
    }
  }
  console.log(`Checked ${journals.length} journals. Unbalanced: ${unbalanced}`);
  
  // Find orphan GRN items
  const orphanItems = await prisma.goodsReceiptItem.count({ where: { goodsReceiptId: null } });
  console.log(`Orphan GRN Items: ${orphanItems}`);
}
checkDB().finally(() => prisma.$disconnect());


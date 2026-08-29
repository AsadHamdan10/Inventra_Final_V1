const fs = require('fs');

function filterCancelled(file) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    
    // Add status != CANCELLED to queries
    code = code.replace(/prisma\.sale\.findMany\(\{\s*where:\s*\{/g, 'prisma.sale.findMany({ where: { status: { not: "CANCELLED" },');
    code = code.replace(/prisma\.sale\.aggregate\(\{\s*where:\s*\{/g, 'prisma.sale.aggregate({ where: { status: { not: "CANCELLED" },');
    code = code.replace(/prisma\.sale\.count\(\{\s*where:\s*\{/g, 'prisma.sale.count({ where: { status: { not: "CANCELLED" },');
    
    code = code.replace(/prisma\.purchase\.findMany\(\{\s*where:\s*\{/g, 'prisma.purchase.findMany({ where: { status: { not: "CANCELLED" },');
    code = code.replace(/prisma\.purchase\.aggregate\(\{\s*where:\s*\{/g, 'prisma.purchase.aggregate({ where: { status: { not: "CANCELLED" },');
    code = code.replace(/prisma\.purchase\.count\(\{\s*where:\s*\{/g, 'prisma.purchase.count({ where: { status: { not: "CANCELLED" },');

    fs.writeFileSync(file, code);
}

filterCancelled('src/controllers/reportController.ts');
filterCancelled('src/controllers/dashboardController.ts');
filterCancelled('src/controllers/saleController.ts');
filterCancelled('src/controllers/purchaseController.ts');
filterCancelled('src/services/gstService.ts');

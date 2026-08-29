const fs = require('fs');

let path = 'src/controllers/saleController.ts';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('new Prisma.Decimal(available - consume)')) {
        // Make sure Prisma is imported or available
        if (!lines[0].includes('Prisma')) {
            lines[0] = "import { PrismaClient, Prisma } from '@prisma/client';";
        }
    }
    
    if (lines[i].includes('...data, invoiceDate: new Date(data.invoiceDate)')) {
        lines[i] = lines[i].replace('...data,', '...data, invoiceNo: existingSale.invoiceNo,');
    }
    
    if (lines[i].includes('const sItem = updated.items.find')) {
        lines[i] = lines[i].replace('updated.items.find', '(updated as any).items.find').replace('si =>', '(si: any) =>');
    }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');

let path2 = 'src/controllers/purchaseController.ts';
let lines2 = fs.readFileSync(path2, 'utf8').split('\n');
if (!lines2[0].includes('Prisma')) {
    lines2[0] = "import { PrismaClient, Prisma } from '@prisma/client';";
}
fs.writeFileSync(path2, lines2.join('\n'), 'utf8');
console.log('Fixed TS by lines');

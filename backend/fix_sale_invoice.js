const fs = require('fs');
let path = 'src/controllers/saleController.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix createSale missing invoiceNo
content = content.replace(
/const sale = await tx\.sale\.create\(\{\n\s*data: \{\n\s*userId,\n\s*\.\.\.data,/g,
`const sale = await tx.sale.create({
            data: {
                userId,
                invoiceNo,
                ...data,`
);

// Fix TS any
content = content.replace(/\(updated as any\)\.items\.find/g, 'updated.items.find');
content = content.replace(/\(si: any\) =>/g, 'si =>');
content = content.replace(/invoiceNo: existingSale\.invoiceNo,/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed createSale invoiceNo');

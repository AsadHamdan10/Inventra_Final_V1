const fs = require('fs');

function fixIsInterState(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const \{ invoiceNo, items, companyGstin, dueDate, \.\.\.data \} = parsed\.data;/g, 
                              'const { invoiceNo, items, companyGstin, dueDate, isInterState, ...data } = parsed.data;');
    content = content.replace(/const \{ items, \.\.\.data \} = parsed\.data;/g, 
                              'const { items, isInterState, ...data } = parsed.data;');
    fs.writeFileSync(file, content, 'utf8');
}

fixIsInterState('src/controllers/saleController.ts');
fixIsInterState('src/controllers/purchaseController.ts');
console.log('Fixed isInterState');

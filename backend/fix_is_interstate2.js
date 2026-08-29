const fs = require('fs');

function fixIsInterState(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const \{ invoiceNo, items, companyGstin, dueDate, isInterState, \.\.\.data \} = parsed\.data;/g, 
                              'const { invoiceNo, items, companyGstin, dueDate, isInterState: _ignore1, ...data } = parsed.data;');
    content = content.replace(/const \{ items, isInterState, \.\.\.data \} = parsed\.data;/g, 
                              'const { items, isInterState: _ignore2, ...data } = parsed.data;');
    fs.writeFileSync(file, content, 'utf8');
}

fixIsInterState('src/controllers/saleController.ts');
fixIsInterState('src/controllers/purchaseController.ts');
console.log('Fixed isInterState alias');

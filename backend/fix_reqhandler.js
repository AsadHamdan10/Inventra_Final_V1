const fs = require('fs');

function fixController(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if RequestHandler is imported
    if (!content.includes('RequestHandler')) {
        content = "import { RequestHandler } from 'express';\n" + content;
    }
    
    fs.writeFileSync(file, content, 'utf8');
}

fixController('src/controllers/saleController.ts');
fixController('src/controllers/purchaseController.ts');
fixController('src/controllers/materialController.ts');
fixController('src/controllers/reportController.ts');
console.log('Added RequestHandler import');

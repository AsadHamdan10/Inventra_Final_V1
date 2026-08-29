const fs = require('fs');

function unfixRouter(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/ as any/g, '');
    fs.writeFileSync(file, content, 'utf8');
}

unfixRouter('src/routes/sales.ts');
unfixRouter('src/routes/purchases.ts');
unfixRouter('src/routes/materials.ts');
unfixRouter('src/routes/reports.ts');
console.log('Unfixed routers');

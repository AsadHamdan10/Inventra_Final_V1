const fs = require('fs');
let path = 'test_tenant_isolation.js';
let content = fs.readFileSync(path, 'utf8');

// The test creates sale then purchase. Swap them!
const saleMatch = /const bSale = await reqAuth\('POST', '\/sales', tokenB[\s\S]*?if \(bSale\.status !== 201\) console\.error\("Setup Error bSale:", bSale\.body\);/m;
const purMatch = /const bPurchase = await reqAuth\('POST', '\/purchases', tokenB[\s\S]*?if \(bPurchase\.status !== 201\) console\.error\("Setup Error bPurchase:", bPurchase\.body\);/m;

const saleText = content.match(saleMatch)[0];
const purText = content.match(purMatch)[0];

content = content.replace(saleText, '%%SALE%%');
content = content.replace(purText, saleText);
content = content.replace('%%SALE%%', purText);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed test_tenant_isolation setup order');

const fs = require('fs');
let code = fs.readFileSync('src/services/saleInternalService.ts', 'utf8');
code = code.replace(/const materialArray = await tx\.\$queryRaw`SELECT \* FROM materials WHERE id = \$\{item\.materialId\} FOR UPDATE`;/g, 
"const materialArray: any = await tx.$queryRaw`SELECT * FROM materials WHERE id = ${Number(item.materialId)} FOR UPDATE`;\n    console.log('materialArray:', materialArray);");
fs.writeFileSync('src/services/saleInternalService.ts', code);

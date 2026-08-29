const fs = require('fs');
let code = fs.readFileSync('src/services/saleInternalService.ts', 'utf8');
code = code.replace(/const materialArray: any = await tx\.\$queryRaw`SELECT \* FROM materials WHERE id = \$\{Number\(item\.materialId\)\} FOR UPDATE`;\n\s*console\.log\('materialArray:', materialArray\);\n\s*const material = materialArray\[0\];/g, 
  "await tx.$executeRaw`SELECT id FROM materials WHERE id = ${item.materialId} FOR UPDATE`;\n    const material = await tx.material.findUnique({ where: { id: item.materialId } });");
code = code.replace(/if \(!material \|\| Number\(material\.current_stock\) < Number\(item\.quantity\)\) throw new Error/g, 
  "if (!material || Number(material.currentStock) < Number(item.quantity)) throw new Error");
code = code.replace(/materialName: material\.material_name/g, "materialName: material.materialName");
fs.writeFileSync('src/services/saleInternalService.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/services/saleInternalService.ts', 'utf8');
code = code.replace(/const material = await tx\.material\.findUnique\(\{ where: \{ id: item\.materialId \} \}\);/g, "const materialArray = await tx.$queryRaw\`SELECT * FROM materials WHERE id = ${item.materialId} FOR UPDATE\`;\n    const material = materialArray[0];");
code = code.replace(/if \(!material\) throw new Error/g, "if (!material || Number(material.current_stock) < Number(item.quantity)) throw new Error");
code = code.replace(/material\.materialName/g, "material.material_name");
fs.writeFileSync('src/services/saleInternalService.ts', code);

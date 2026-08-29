const fs = require('fs');
let path = 'test_financial_authority.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
`materialName: material.materialName, materialId: material.id,
            quantity: 1,`,
`materialName: material.materialName, materialId: material.id,
            quantity: 2,`
);

fs.writeFileSync(path, content, 'utf8');

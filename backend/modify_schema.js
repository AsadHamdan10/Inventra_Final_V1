const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

// For Sale
code = code.replace(/grandTotal\s+Decimal\s+@default\(0\)\s+@map\("grand_total"\)\s+@db\.Decimal\(15,\s*2\)/g, 'grandTotal           Decimal             @default(0) @map("grand_total") @db.Decimal(15, 2)\n  status               String              @default("ACTIVE") @db.VarChar(20)');

fs.writeFileSync('prisma/schema.prisma', code);

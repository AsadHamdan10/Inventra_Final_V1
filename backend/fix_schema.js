const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

s = s.replace('    rcm            Boolean              @default(false)\n    itcEligibility String               @default("ELIGIBLE") @db.VarChar(30)\n', '');

s = s.replace(/model Purchase {\s+id[\s\S]*?totalGst[\s\S]*?@db\.Decimal\(15, 2\)/, match => match + '\n    rcm               Boolean                   @default(false)\n    itcEligibility    String                    @default("ELIGIBLE") @db.VarChar(30)');

fs.writeFileSync('prisma/schema.prisma', s);

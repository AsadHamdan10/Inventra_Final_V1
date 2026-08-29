const fs = require('fs');

let text = fs.readFileSync('test_transaction_reversal.js', 'utf8');
const createScript = `
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password123', 12);
  await prisma.user.create({
    data: { companyName: 'Rev Corp', username: 'reversalt', email: 'reversalt@test.com', password: hash, role: 'admin', status: 'approved' }
  });
`;
text = text.replace("console.log('--- RUNNING TRANSACTION REVERSAL TEST SUITE ---');", "console.log('--- RUNNING TRANSACTION REVERSAL TEST SUITE ---');\n" + createScript);
fs.writeFileSync('test_transaction_reversal.js', text);

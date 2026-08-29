const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const res = await prisma.$queryRaw`SELECT name, start_date, end_date FROM accounting_periods ORDER BY period_number LIMIT 2`;
    console.log(res);
}
run();

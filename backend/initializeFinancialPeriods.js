const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting Financial Year Boundary Remediation...');
    const users = await prisma.user.findMany();
    
    // For India FY 2026-2027
    const fyStartDate = new Date('2026-04-01T00:00:00.000Z');
    const fyEndDate = new Date('2027-04-01T00:00:00.000Z'); // Exclusive
    
    for (const user of users) {
        // Find existing FY and repair
        let fy = await prisma.financialYear.findFirst({
            where: {
                userId: user.id,
                name: 'FY 2026-2027'
            }
        });
        
        if (fy) {
            fy = await prisma.financialYear.update({
                where: { id: fy.id },
                data: { startDate: fyStartDate, endDate: fyEndDate }
            });
            console.log(`Repaired FY for user ${user.id}`);
        } else {
            fy = await prisma.financialYear.create({
                data: {
                    userId: user.id,
                    name: 'FY 2026-2027',
                    startDate: fyStartDate,
                    endDate: fyEndDate,
                    status: 'OPEN'
                }
            });
            console.log(`Created FY for user ${user.id}`);
        }
        
        // Create periods
        for (let i = 0; i < 12; i++) {
            let startMonth = 3 + i; // April is 3
            let startYear = 2026;
            if (startMonth > 11) {
                startMonth -= 12;
                startYear++;
            }
            
            // Format strictly as UTC so @db.Date doesn't shift days
            const periodStartStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`;
            const periodStart = new Date(periodStartStr);
            
            // Next month exclusive boundary
            let nextMonth = startMonth + 1;
            let nextYear = startYear;
            if (nextMonth > 11) {
                nextMonth -= 12;
                nextYear++;
            }
            const periodEndStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`;
            const periodEnd = new Date(periodEndStr);
            
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const pName = `${monthNames[startMonth]} ${startYear}`;
            
            let period = await prisma.accountingPeriod.findFirst({
                where: {
                    userId: user.id,
                    financialYearId: fy.id,
                    periodNumber: i + 1
                }
            });
            
            if (period) {
                await prisma.accountingPeriod.update({
                    where: { id: period.id },
                    data: { startDate: periodStart, endDate: periodEnd }
                });
                console.log(`  Repaired period ${pName} for user ${user.id}`);
            } else {
                await prisma.accountingPeriod.create({
                    data: {
                        userId: user.id,
                        financialYearId: fy.id,
                        periodNumber: i + 1,
                        name: pName,
                        startDate: periodStart,
                        endDate: periodEnd,
                        status: 'OPEN'
                    }
                });
                console.log(`  Created period ${pName} for user ${user.id}`);
            }
        }
    }
    
    console.log('Migration complete.');
}

migrate().catch(console.error).finally(() => prisma.$disconnect());

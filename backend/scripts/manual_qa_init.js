const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initQA() {
    console.log("=== INVENTRA V1 MANUAL QA INITIALIZATION ===");
    
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.includes('development')) {
        console.error("SAFETY ABORT: DATABASE_URL does not contain 'development'.");
        process.exit(1);
    }

    try {
        // 1. Super Admin
        console.log("1. Creating Super Admin...");
        const hash = await bcrypt.hash('Inventra@123', 10);
        const sa = await prisma.user.create({
            data: {
                email: 'superadmin@inventra.local',
                username: 'superadmin',
                password: hash,
                companyName: 'INVENTRA',
                role: 'super_admin',
                status: 'approved'
            }
        });

        // 2. QA Tenant (Admin)
        console.log("2. Creating Test Tenant Admin...");
        const tenantHash = await bcrypt.hash('Tenant@123', 10);
        const tenantUser = await prisma.user.create({
            data: {
                email: 'admin@testindustries.local',
                username: 'admin',
                password: tenantHash,
                companyName: 'INVENTRA TEST INDUSTRIES',
                role: 'admin',
                status: 'approved',
                gstin: '29ABCDE1234F1Z5',
                
                addressLine1: '123 QA Lane, Tech Park',
                city: 'Bangalore',
                state: 'Karnataka',
                pincode: '560001'
            }
        });

        // 3. Tenant Configuration
        console.log("3. Configuring Tenant Business Type...");
        await prisma.tenantConfiguration.create({
            data: {
                userId: tenantUser.id,
                businessType: 'BOTH'
            }
        });

        // 4. Warehouses
        console.log("4. Creating Warehouses...");
        const mainW = await prisma.warehouse.create({ data: { userId: tenantUser.id, name: 'MAIN', code: 'W-MAIN', warehouseType: 'GENERAL' } });
        await prisma.warehouse.create({ data: { userId: tenantUser.id, name: 'RAW MATERIAL', code: 'W-RM', warehouseType: 'GENERAL' } });
        await prisma.warehouse.create({ data: { userId: tenantUser.id, name: 'FINISHED GOODS', code: 'W-FG', warehouseType: 'GENERAL' } });

        await prisma.tenantConfiguration.updateMany({
            where: { userId: tenantUser.id },
            data: { defaultWarehouseId: mainW.id }
        });

        // 5. Chart of Accounts
        console.log("5. Initializing Chart of Accounts...");
        const coaData = [
            { code: '1000', name: 'Cash and Bank', accountType: 'asset' },
            { code: '1100', name: 'Accounts Receivable', accountType: 'asset' },
            { code: '1200', name: 'Raw Material Inventory', accountType: 'asset' },
            { code: '1210', name: 'Finished Goods Inventory', accountType: 'asset' },
            { code: '1220', name: 'Work In Progress Inventory', accountType: 'asset' },
            { code: '2000', name: 'Accounts Payable', accountType: 'liability' },
            { code: '2100', name: 'Output CGST', accountType: 'liability' },
            { code: '2101', name: 'Output SGST', accountType: 'liability' },
            { code: '2102', name: 'Output IGST', accountType: 'liability' },
            { code: '1300', name: 'Input CGST', accountType: 'asset' },
            { code: '1301', name: 'Input SGST', accountType: 'asset' },
            { code: '1302', name: 'Input IGST', accountType: 'asset' },
            { code: '3000', name: 'Opening Balance Equity', accountType: 'equity' },
            { code: '4000', name: 'Sales Revenue', accountType: 'revenue' },
            { code: '5000', name: 'Cost of Goods Sold', accountType: 'expense' },
            { code: '5100', name: 'Purchase Return Variance', accountType: 'expense' }
        ];
        for (const c of coaData) await prisma.chartOfAccount.create({ data: { userId: tenantUser.id, ...c } });

        // 6. Financial Year
        console.log("6. Initializing Financial Year...");
        await prisma.financialYear.create({
            data: {
                userId: tenantUser.id,
                name: 'FY 2026-27',
                startDate: new Date('2026-04-01T00:00:00.000Z'),
                endDate: new Date('2027-03-31T23:59:59.999Z'),
                status: 'OPEN'
            }
        });

        // 7. Master Data
        console.log("7. Seeding Test Master Data...");
        const cat = await prisma.itemCategory.create({ data: { userId: tenantUser.id, name: 'General', code: 'CAT-GEN', description: 'General Items' } });
        await prisma.material.create({ data: { userId: tenantUser.id, materialName: 'Raw Material A', itemCode: 'RM-001', itemType: 'RAW_MATERIAL', categoryId: cat.id, unit: 'Nos', taxability: 'TAXABLE', hsnCode: '1001', gstRate: 18 } });
        await prisma.material.create({ data: { userId: tenantUser.id, materialName: 'Raw Material B', itemCode: 'RM-002', itemType: 'RAW_MATERIAL', categoryId: cat.id, unit: 'Nos', taxability: 'TAXABLE', hsnCode: '1002', gstRate: 18 } });
        await prisma.material.create({ data: { userId: tenantUser.id, materialName: 'Semi Finished Product', itemCode: 'SF-001', itemType: 'SEMI_FINISHED_GOOD', categoryId: cat.id, unit: 'Nos', taxability: 'TAXABLE', hsnCode: '2001', gstRate: 18 } });
        await prisma.material.create({ data: { userId: tenantUser.id, materialName: 'Finished Product', itemCode: 'FG-001', itemType: 'FINISHED_GOOD', categoryId: cat.id, unit: 'Nos', taxability: 'TAXABLE', hsnCode: '3001', gstRate: 18 } });
        await prisma.material.create({ data: { userId: tenantUser.id, materialName: 'Trading Product', itemCode: 'TG-001', itemType: 'TRADING_GOOD', categoryId: cat.id, unit: 'Nos', taxability: 'TAXABLE', hsnCode: '4001', gstRate: 18 } });

        await prisma.customer.create({ data: { userId: tenantUser.id, companyName: 'Test Customer A Pvt Ltd', gstin: '29ABCDE1111F1Z5',  address: 'Local' } });
        await prisma.vendor.create({ data: { userId: tenantUser.id, vendorName: 'Test Vendor A Pvt Ltd', vendorGstin: '29XYZDE2222F1Z5',  address: 'Local' } });

        console.log("\n=== INITIALIZATION COMPLETE ===");
    } catch(e) {
        console.error("Failed QA init:", e);
    } finally {
        await prisma.$disconnect();
    }
}
initQA();

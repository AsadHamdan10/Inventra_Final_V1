import { PrismaClient } from '@prisma/client';
import assert from 'assert';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function run() {
    const users = await prisma.user.findMany({ where: { role: 'admin' }, take: 1 });
    if (users.length === 0) return;
    const user = users[0];
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, tenantId: user.id },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Create a material
    const material = await prisma.material.create({
        data: {
            userId: user.id,
            materialName: 'Test HTTP FIFO Material',
            itemCode: 'HTTP-FIFO-4',
            inventoryTracked: true,
            currentStock: 10,
            unit: 'pcs',
            gstRate: 18,
            standardCost: 10,
            
        }
    });

    const customer = await prisma.customer.create({
        data: {
            userId: user.id,
            companyName: 'Test HTTP Customer',
        }
    });

    // Try to sell 20 units (only 10 available)
    console.log('Sending HTTP POST to /api/v1/sales for 20 units...');
    const res = await fetch('http://localhost:5000/api/v1/sales', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            customerId: customer.id,
            invoiceDate: new Date().toISOString(),
            isInterState: false,
            items: [
                {
                    materialId: material.id,
                    quantity: 20,
                    unitPrice: 100,
                    gstPercent: 18
                }
            ]
        })
    });

    const body = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', body);
    
    assert(res.status === 500 || res.status === 400, "Should return an error status");
    assert(body.error && body.error.includes("Insufficient stock"), "Should return insufficient stock error");
    console.log("HTTP FIFO API Verification PASSED!");
    
    // Clean up
    await prisma.material.delete({ where: { id: material.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    process.exit(0);
}
run();









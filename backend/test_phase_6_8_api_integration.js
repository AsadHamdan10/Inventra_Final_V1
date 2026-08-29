
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

const API = "http://localhost:5000/api/v1";

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch(e) {
        throw new Error(`Failed to parse JSON: ${res.status} ${text}`);
    }
    return { status: res.status, ok: res.ok, data: json };
}

async function run() {
    let t1, t2;
    try {
        console.log("=== PHASE 6.8 API INTEGRATION E2E ===");

        // --- 1. Setup Tenants ---
        const p1 = await bcrypt.hash("Pass123", 10);
        t1 = await prisma.user.create({ data: { username: "t1_api", companyName: "T1 API", email: "t1api@test.com", status: "active", plan: "PROFESSIONAL", role: "admin", applicationRef: "T1-" + Date.now(), password: p1 }});
        t2 = await prisma.user.create({ data: { username: "t2_api", companyName: "T2 API", email: "t2api@test.com", status: "active", plan: "PROFESSIONAL", role: "admin", applicationRef: "T2-" + Date.now(), password: p1 }});
        
        const { initializeDefaultCOA } = require("./src/services/accounting/coaService");
        await initializeDefaultCOA(t1.id);
        await initializeDefaultCOA(t2.id);

        const l1 = await fetchJSON(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "t1_api", password: "Pass123" }) });
        const tk1 = l1.data.accessToken;
        const h1 = { "Content-Type": "application/json", "Authorization": `Bearer ${tk1}` };

        const l2 = await fetchJSON(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "t2_api", password: "Pass123" }) });
        const tk2 = l2.data.accessToken;
        const h2 = { "Content-Type": "application/json", "Authorization": `Bearer ${tk2}` };

        console.log("Tenants created & logged in.");

        // --- 2. Warehouse API (Tenant 1) ---
        const wh1Req = await fetchJSON(`${API}/inventory/warehouses`, { method: "POST", headers: h1, body: JSON.stringify({ code: "T1-W1", name: "T1 Warehouse", warehouseType: "GENERAL" }) });
        if (!wh1Req.ok) throw new Error("Failed to create warehouse");
        const wh1 = wh1Req.data.data;
        console.log("Warehouse API works.");

        // --- 3. Cross-Tenant Block ---
        const wh2Req = await fetchJSON(`${API}/inventory/warehouses`, { method: "POST", headers: h2, body: JSON.stringify({ code: "T2-W1", name: "T2 Warehouse", warehouseType: "GENERAL" }) });
        const wh2 = wh2Req.data.data;
        const whList2 = await fetchJSON(`${API}/inventory/warehouses`, { headers: h2 });
        if (whList2.data.data.find(w => w.id === wh1.id)) throw new Error("Tenant 2 can see Tenant 1 warehouse!");
        console.log("Cross-tenant blocked.");

        // --- 4. Master Data ---
        const v1 = (await fetchJSON(`${API}/vendors`, { method: "POST", headers: h1, body: JSON.stringify({ name: "T1 Vendor", email: "v1@t1.com", status: "ACTIVE" }) })).data.data || (await fetchJSON(`${API}/vendors`, { method: "POST", headers: h1, body: JSON.stringify({ name: "T1 Vendor", email: "v1@t1.com", status: "ACTIVE" }) })).data;
        const c1 = (await fetchJSON(`${API}/customers`, { method: "POST", headers: h1, body: JSON.stringify({ name: "T1 Customer", email: "c1@t1.com", status: "ACTIVE" }) })).data.data || (await fetchJSON(`${API}/customers`, { method: "POST", headers: h1, body: JSON.stringify({ name: "T1 Customer", email: "c1@t1.com", status: "ACTIVE" }) })).data;
        const m1 = (await fetchJSON(`${API}/materials`, { method: "POST", headers: h1, body: JSON.stringify({ itemType: "FINISHED_GOOD", materialName: "Laptop", hsnCode: "8471", unit: "NOS", standardPrice: 50000, standardCost: 40000, inventoryTracked: true, purchaseEnabled: true, salesEnabled: true, gstRate: 18, taxability: "TAXABLE" }) })).data;
        const mData = m1.data || m1;
        const vData = v1.data || v1;
        const cData = c1.data || c1;

        // --- 5. GRN Minimal Payload ---
        const grnReq = await fetchJSON(`${API}/goods-receipts`, { method: "POST", headers: h1, body: JSON.stringify({
            vendorId: vData.id,
            warehouseId: wh1.id,
            grnDate: new Date().toISOString(),
            deliveryChallanNo: "CH-1",
            items: [{ materialId: mData.id, receivedQty: 10, unitPrice: 40000 }]
        })});
        if (!grnReq.ok) throw new Error("GRN creation failed: " + JSON.stringify(grnReq.data));
        console.log("GRN Minimal Payload parsed and Vendor derived.");

        await fetchJSON(`${API}/goods-receipts/${grnReq.data.id}/status`, { method: "PATCH", headers: h1, body: JSON.stringify({ status: "POSTED" }) });
        
        // --- 6. Inventory Layer API ---
        const layerReq = await fetchJSON(`${API}/inventory/transfers/../layers?materialId=${mData.id}`, { headers: h1 });
        if (!layerReq.ok) throw new Error("Layer API failed");
        if (layerReq.data.data.length === 0) throw new Error("No layers found");
        console.log("Inventory Layer API works.");

        // --- 7. Sales Minimal Payload ---
        const saleReq = await fetchJSON(`${API}/sales`, { method: "POST", headers: h1, body: JSON.stringify({
            customerId: cData.id,
            invoiceDate: new Date().toISOString(),
            items: [{ materialId: mData.id, warehouseId: wh1.id, quantity: 2, unitPrice: 50000 }]
        })});
        if (!saleReq.ok) throw new Error("Sale creation failed: " + JSON.stringify(saleReq.data));
        
        const sale = saleReq.data.data;
        if (Number(sale.totalTaxable) !== 100000) throw new Error("Sale totalTaxable not calculated properly: " + sale.totalTaxable);
        if (Number(sale.totalGst) !== 18000) throw new Error("Sale GST not calculated properly: " + sale.totalGst);
        if (Number(sale.grandTotal) !== 118000) throw new Error("Sale grand total wrong: " + sale.grandTotal);
        console.log("Sales Backend calculation works.");

        // --- 8. Accounting & FIFO Reconciliation ---
        const journals = await prisma.journalEntry.findMany({ where: { userId: t1.id }, include: { lines: true }});
        let unbalanced = 0;
        for(let j of journals) {
            let dr = 0, cr = 0;
            for (let l of j.lines) {
                dr += Number(l.debit); cr += Number(l.credit);
            }
            if (Math.abs(dr - cr) > 0.01) unbalanced++;
        }
        if (unbalanced > 0) throw new Error(`Found ${unbalanced} unbalanced journals`);
        console.log("Accounting Reconciliation passed.");

        const stock = await prisma.inventoryLayer.findMany({ where: { materialId: mData.id } });
        if (Number(stock[0].remainingQty) !== 8) throw new Error("FIFO consumption failed. Remaining stock: " + stock[0].remainingQty);
        console.log("FIFO Reconciliation passed.");

        console.log("ALL TESTS PASSED SUCCESSFULLY.");
    } catch(e) {
        console.error("Test failed:", e);
    } finally {
        if(t1) {
            await prisma.$executeRawUnsafe(`DELETE FROM "InventoryLayer" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "InventoryLedger" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "JournalEntry" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Account" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Sale" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "GoodsReceipt" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Material" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Vendor" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.$executeRawUnsafe(`DELETE FROM "Warehouse" WHERE "userId" = ${t1.id} OR "userId" = ${t2.id}`);
            await prisma.user.deleteMany({ where: { id: { in: [t1.id, t2.id] } }});
        }
        await prisma.$disconnect();
    }
}

run();


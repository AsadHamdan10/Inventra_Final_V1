const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const API = "http://localhost:5000/api/v1";

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error(`Failed to parse JSON: ${res.status} ${text}`); }
    return { status: res.status, ok: res.ok, data: json };
}

async function run() {
    let t1, adminUser;
    try {
        console.log("=== PHASE 6.9 SAAS BILLING SECURITY E2E ===");
        const ts = Date.now();
        const p1 = await bcrypt.hash("Pass123", 10);
        
        // Setup a normal tenant
        t1 = await prisma.user.create({ data: { username: "saas_t1_" + ts, companyName: "SaaS Tenant", email: `saast1_${ts}@test.com`, status: "active", plan: "TRADING", role: "admin", applicationRef: "ST1-" + ts, password: p1 }});
        
        // Setup super admin
        adminUser = await prisma.user.create({ data: { username: "saas_admin_" + ts, companyName: "INVENTRA PLATFORM", email: `sadmin_${ts}@inventra.com`, status: "active", plan: "SUPER", role: "super_admin", applicationRef: "SADMIN-" + ts, password: p1 }});

        const l1 = await fetchJSON(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: t1.username, password: "Pass123" }) });
        const tk1 = l1.data.accessToken;
        const h1 = { "Content-Type": "application/json", "Authorization": `Bearer ${tk1}` };

        const lAdmin = await fetchJSON(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUser.username, password: "Pass123" }) });
        const tkAdmin = lAdmin.data.accessToken;
        const hAdmin = { "Content-Type": "application/json", "Authorization": `Bearer ${tkAdmin}` };

        // 1. Check Plans
        const plansReq = await fetchJSON(`${API}/admin/plans`, { headers: hAdmin });
        if(!plansReq.ok) throw new Error("Failed to fetch plans: " + JSON.stringify(plansReq.data));
        const plans = plansReq.data;
        const tradingPlan = plans.find(p => p.code === "TRADING_ANNUAL");
        if(Number(tradingPlan.annualPrice) !== 3499) throw new Error("Trading price mismatch");
        console.log("Plan API works and prices match.");

        // 2. Security Test - Normal user shouldn't access plans
        const secReq = await fetchJSON(`${API}/admin/plans`, { headers: h1 });
        if(secReq.status !== 403) throw new Error("Security Failure: Normal tenant accessed admin plans");
        console.log("Tenant isolation enforced.");

        // 3. Create Subscription
        const subReq = await fetchJSON(`${API}/admin/subscriptions`, { method: "POST", headers: hAdmin, body: JSON.stringify({
            userId: t1.id, planId: tradingPlan.id, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 31536000000).toISOString(),
            discountAmount: 499, notes: "Discounted trading"
        })});
        if(!subReq.ok) throw new Error("Failed to create sub: " + JSON.stringify(subReq.data));
        const sub = subReq.data;
        if(Number(sub.finalAmount) !== 3000) throw new Error("Final amount miscalculated");
        if(sub.status !== "UNPAID") throw new Error("Status should be UNPAID");
        console.log("Subscription created properly. Final Amount: 3000");

        // 4. Record Partial Payment
        const p1Req = await fetchJSON(`${API}/admin/subscriptions/${sub.id}/payments`, { method: "POST", headers: hAdmin, body: JSON.stringify({
            amountReceived: 2000, paymentDate: new Date().toISOString(), paymentMethod: "BANK_TRANSFER", transactionReference: "TXN123"
        })});
        if(!p1Req.ok) throw new Error("Failed payment: " + JSON.stringify(p1Req.data));
        console.log("Partial payment successful.");

        // Fetch sub to check status
        let subCheck = await fetchJSON(`${API}/admin/subscriptions/${sub.id}`, { headers: hAdmin });
        if(subCheck.data.status !== "PARTIALLY_PAID") throw new Error("Status should be PARTIALLY_PAID");

        // 5. Overpayment Protection
        const p2Req = await fetchJSON(`${API}/admin/subscriptions/${sub.id}/payments`, { method: "POST", headers: hAdmin, body: JSON.stringify({
            amountReceived: 1500, paymentDate: new Date().toISOString(), paymentMethod: "BANK_TRANSFER", transactionReference: "TXN456"
        })});
        if(p2Req.status !== 400) throw new Error("Overpayment Protection Failed");
        console.log("Overpayment blocked.");

        // 6. Final Payment
        const p3Req = await fetchJSON(`${API}/admin/subscriptions/${sub.id}/payments`, { method: "POST", headers: hAdmin, body: JSON.stringify({
            amountReceived: 1000, paymentDate: new Date().toISOString(), paymentMethod: "BANK_TRANSFER", transactionReference: "TXN456"
        })});
        if(!p3Req.ok) throw new Error("Failed payment 3");
        
        subCheck = await fetchJSON(`${API}/admin/subscriptions/${sub.id}`, { headers: hAdmin });
        if(subCheck.data.status !== "PAID") throw new Error("Status should be PAID");
        console.log("Subscription PAID.");

        // 7. Commission
        const paymentId = p1Req.data.id;
        const commReq = await fetchJSON(`${API}/admin/payments/${paymentId}/commission`, { method: "POST", headers: hAdmin, body: JSON.stringify({
            marketerName: "Affiliate A", commissionAmount: 500, notes: "Signup bonus"
        })});
        if(!commReq.ok) throw new Error("Commission failed");
        console.log("Commission recorded.");

        // 8. Revenue Calculation
        const revReq = await fetchJSON(`${API}/admin/revenue`, { headers: hAdmin });
        const rev = revReq.data;
        console.log(`Gross: ${rev.totalCollected}, Commission: ${rev.marketerCommission}, Net: ${rev.netRevenue}`);
        if(rev.netRevenue !== (rev.totalCollected - rev.marketerCommission)) throw new Error("Net Revenue Math Failure");

        console.log("ALL TESTS PASSED SUCCESSFULLY.");
    } catch(e) {
        console.error("Test failed:", e);
    } finally {
        if(t1) {
            await prisma.$executeRawUnsafe(`DELETE FROM "saas_commissions"`);
            await prisma.$executeRawUnsafe(`DELETE FROM "saas_payments"`);
            await prisma.$executeRawUnsafe(`DELETE FROM "saas_subscriptions"`);
            await prisma.user.deleteMany({ where: { id: { in: [t1.id, adminUser.id] } }});
        }
        await prisma.$disconnect();
    }
}
run();

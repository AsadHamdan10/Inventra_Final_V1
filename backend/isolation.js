
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const API = "http://localhost:5000/api/v1";

async function testIsolation() {
  try {
    const qa1Res = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_master2", password: "QA@Pass123" }) // we know this is active
    });
    const token1 = (await qa1Res.json()).accessToken;
    const headers1 = { "Content-Type": "application/json", "Authorization": `Bearer ${token1}` };
    
    // Create WH for QA Master 2
    const whRes1 = await fetch(`${API}/inventory/warehouses`, {
      method: "POST", headers: headers1, body: JSON.stringify({ code: "W-ISO", name: "ISO WH" })
    });
    const wh1 = await whRes1.json();
    
    // List WH
    const whList = await fetch(`${API}/inventory/warehouses`, { headers: headers1 });
    const list = await whList.json();
    console.log("Tenant QA Master 2 WH count:", list.data.length);
    
    // Now Superadmin list WH? No, Superadmin shouldn"t access tenant data in this endpoint without Tenant header probably.
    // Or we test if QA Master 2 sees other warehouses.
    // list.data should only contain QA Master 2"s warehouse.
  } catch(e) { console.error(e); }
}
testIsolation();


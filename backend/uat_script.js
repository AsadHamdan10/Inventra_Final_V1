
const API = "http://localhost:5000/api/v1";

async function runUAT() {
  try {
    console.log("=== PHASE 6.7C: NEW CUSTOMER ONBOARDING ===");
    
    // 1. Register a new customer
    const registerPayload = {
      applicantName: "QA Trader 11",
      email: "qa_trader11@example.com",
      mobile: "9999999981",
      username: "qa_trading11",
      companyName: "QA Trading Co. 11",
      businessType: "TRADING",
      industry: "Retail",
      plan: "PROFESSIONAL",
      country: "India",
      timezone: "Asia/Kolkata",
      currency: "INR"
    };
    
    console.log("Submitting registration...");
    const regRes = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload)
    });
    const regData = await regRes.json();
    console.log("Registration Response:", regData);
    
    if (!regRes.ok) throw new Error("Registration failed");
    
    const referenceNo = regData.applicationRef;
    console.log("Application Reference:", referenceNo);
    
    // 2. Super Admin Approval (Phase 6.7D)
    console.log("\n=== PHASE 6.7D: SUPER ADMIN APPLICATION REVIEW ===");
    const loginRes = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "superadmin", password: "Inventra@123" })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error("Superadmin login failed: " + JSON.stringify(loginData));
    
    const saToken = loginData.accessToken;
    
    // Get apps
    const appsRes = await fetch(`${API}/admin/applications`, {
      headers: { "Authorization": `Bearer ${saToken}` }
    });
    const appsData = await appsRes.json();
    
    const myApp = appsData.find(a => a.applicationRef === referenceNo);
    if (!myApp) throw new Error("Application not found in list");
    const userId = myApp.userId;
    console.log(`Application found. UserId: ${userId}`);
    
    // Approve application
    console.log(`Approving application ${referenceNo} (userId: ${userId})...`);
    const approveRes = await fetch(`${API}/admin/users/${userId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${saToken}` }
    });
    const approveData = await approveRes.json();
    console.log("Approve Response:", approveData);
    if (!approveRes.ok) throw new Error("Approval failed");
    
    // Test Rejection
    console.log("\n=== PHASE 6.7D: REJECTION FLOW ===");
    const regRes2 = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...registerPayload, username: "qa_trading12", companyName: "QA Trading Co. 12", email: "qa_trader12@example.com", mobile: "9999999980" })
    });
    const ref2 = (await regRes2.json()).applicationRef;
    const appsRes2 = await fetch(`${API}/admin/applications`, { headers: { "Authorization": `Bearer ${saToken}` } });
    const userId2 = (await appsRes2.json()).find(a => a.applicationRef === ref2).userId;
    
    const rejectRes = await fetch(`${API}/admin/users/${userId2}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${saToken}` },
      body: JSON.stringify({ reason: "Duplicate QA account" })
    });
    console.log("Reject Response:", await rejectRes.json());
    
  } catch (error) {
    console.error("UAT Error:", error);
  }
}

runUAT();


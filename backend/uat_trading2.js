
const API = "http://localhost:5000/api/v1";

async function runTradingE2E() {
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_trading11", password: "QA@Pass123" })
    });
    const loginData = await loginRes.json();
    console.log("loginData:", loginData);
    
  } catch (err) { console.error(err); }
}
runTradingE2E();


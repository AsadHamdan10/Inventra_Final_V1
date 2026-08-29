
const API = "http://localhost:5000/api/v1";

async function testRecovery() {
  try {
    // 1. Forgot password
    console.log("Requesting password reset...");
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail: "qa_master2@example.com" }) 
    });
    const resData = await res.json();
    console.log("Forgot Password response:", resData);

  } catch(e) { console.error(e); }
}
testRecovery();


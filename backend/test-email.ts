import "dotenv/config";
import { sendRegistrationConfirmation } from "./src/services/emailService";

async function runTest() {
  const recipient = "maniyaliasadhamdan@gmail.com";
  console.log("Initiating real SMTP test to:", recipient);
  
  await sendRegistrationConfirmation(
    recipient,
    "Royal Enterprises",
    "INV-EMAIL-TEST"
  );
  
  console.log("Email test completed.");
}

runTest().catch(console.error);

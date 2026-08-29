const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "backend/src/services/emailService.ts");
let content = fs.readFileSync(file, "utf8");

content = content.replace(/export async function sendApprovalNotification[\s\S]*?body,\n  \}\);\n\}/,
`export async function sendApprovalNotification(email: string, companyName: string, applicationRef: string | null, activationLink: string): Promise<void> {
  const refText = applicationRef ? \`\\nApplication Reference: \${applicationRef}\` : "";
  
  const body = \`
Dear \${companyName},

Your INVENTRA Account application has been APPROVED!
\${refText}

Please activate your account and set your password by clicking the secure link below:
\${activationLink}

This link is valid for 24 hours.

Thank you,
The INVENTRA Team
  \`.trim();

  await sendEmail({
    to: email,
    subject: "Your INVENTRA Account Has Been Approved",
    body,
  });
}`);

content = content.replace(/export async function sendRejectionNotification[\s\S]*?body,\n  \}\);\n\}/,
`export async function sendRejectionNotification(email: string, companyName: string, reason?: string | null): Promise<void> {
  const reasonText = reason ? \`\\nReason: \${reason}\` : "";
  const body = \`
Dear \${companyName},

Regarding your INVENTRA registration:

We regret to inform you that your application was not approved for access at this time.\${reasonText}

If you believe this is an error or would like more information, please contact our support team.

Thank you,
The INVENTRA Team
  \`.trim();

  await sendEmail({
    to: email,
    subject: "INVENTRA Registration Update",
    body,
  });
}`);

fs.writeFileSync(file, content, "utf8");

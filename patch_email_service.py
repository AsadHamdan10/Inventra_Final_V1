import re

with open("backend/src/services/emailService.ts", "r") as f:
    data = f.read()

if "sendPasswordResetEmail" not in data:
    new_email = """
export async function sendPasswordResetEmail(email: string, companyName: string, resetUrl: string): Promise<void> {
  const body = `
Dear ${companyName},

We received a request to reset your INVENTRA password.
If you did not make this request, you can safely ignore this email.

To reset your password, please click the secure link below:
${resetUrl}

This link will expire in 15 minutes.

Thank you,
The INVENTRA Team
  `.trim();

  await sendEmail({
    to: email,
    subject: "INVENTRA Password Reset Request",
    body,
  });
}
"""
    data += "\n" + new_email
    with open("backend/src/services/emailService.ts", "w") as f:
        f.write(data)

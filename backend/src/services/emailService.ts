/**
 * emailService.ts
 * Abstraction layer for sending emails with robust HTML and Plain-Text support.
 * Configured for real Gmail / SMTP delivery in Phase 6.10.
 */

import nodemailer from 'nodemailer';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

const isDev = process.env.NODE_ENV !== 'production';
let transporter: nodemailer.Transporter | null = null;

if (process.env.EMAIL_PROVIDER === 'smtp') {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

/**
 * Robust HTML escaper to prevent dynamic data from breaking the HTML document.
 */
function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Base HTML Template using Gmail-compatible inline CSS.
 */
function getBaseHtmlTemplate(title: string, content: string, ctaHtml: string = ""): string {
  const safeTitle = escapeHtml(title);
  // Using strict, complete HTML document structure and inline styles for Gmail compatibility.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; word-break: break-word;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e1e8ed; overflow: hidden; margin: 0 auto; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">INVENTRA ERP</h1>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Professional Business Management Platform</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px; color: #334155; line-height: 1.6; font-size: 16px;">
              ${content}
              ${ctaHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} INVENTRA. All rights reserved.</p>
              <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Core send function with strict validation and safe logging.
 */
async function sendEmail(payload: EmailPayload): Promise<void> {
  // 1. Validate body is non-empty
  if (!payload.body || payload.body.trim() === '') {
    console.error(`[EMAIL ERROR] Aborting send to ${payload.to}: Plain-text body is empty.`);
    return;
  }

  // 2. Validate/Generate HTML body
  let finalHtml = payload.html;
  if (!finalHtml || finalHtml.trim() === '') {
    // Generate safe HTML from plain text if HTML was omitted or empty
    const safeBodyHtml = escapeHtml(payload.body).replace(/\n/g, '<br>');
    finalHtml = getBaseHtmlTemplate(payload.subject, `<p style="margin: 0;">${safeBodyHtml}</p>`);
  }

  // Fallback to DEV EMAIL ADAPTER if SMTP is not configured
  if (!transporter) {
    console.log(`[DEV EMAIL ADAPTER] (EMAIL_PROVIDER not configured)`);
    console.log(`[EMAIL] Successfully sent to ${payload.to}: ${payload.subject}`);
    console.log(`Message ID: <dev-mode-mock-id-${Date.now()}>`);
    return;
  }

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'INVENTRA ERP';
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    
    // 3. Nodemailer ALWAYS receives from, to, subject, text, html
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,     // Validated non-empty
      html: finalHtml,        // Validated non-empty and well-formed
    });
    
    // 4. Safe Logging
    console.log(`[EMAIL] Successfully sent to ${payload.to}: ${payload.subject}`);
    console.log(`Message ID: ${info.messageId}`);
  } catch (error: any) {
    // 5. Safe Error Logging (No credentials exposed)
    console.error(`[EMAIL ERROR] Failed to send email to ${payload.to}`);
    console.error(`Subject: ${payload.subject}`);
    console.error(`Error Code: ${error.code || 'UNKNOWN'}`);
    console.error(`Error Message: ${error.message || String(error)}`);
    // Note: Deliberately not throwing the error to prevent transaction rollback
  }
}

export async function sendRegistrationConfirmation(email: string, companyName: string, applicationRef: string): Promise<void> {
  const safeCompany = escapeHtml(companyName);
  const safeRef = escapeHtml(applicationRef);

  const body = `Dear ${companyName},\n\nYour INVENTRA registration has been received successfully.\n\nApplication Reference: ${applicationRef}\nStatus: Pending Review\n\nOur team is currently reviewing your application. You will be notified once it has been approved.\n\nThank you for choosing INVENTRA!`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="margin: 0 0 16px 0;">Your INVENTRA registration has been received successfully.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="16" style="background-color: #f1f5f9; border-radius: 6px; margin: 24px 0;">
      <tr>
        <td>
          <p style="margin: 0 0 8px 0;"><strong style="color: #0f172a;">Application Reference:</strong> ${safeRef}</p>
          <p style="margin: 0;"><strong style="color: #0f172a;">Status:</strong> <span style="color: #eab308; font-weight: bold;">Pending Review</span></p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px 0;">Our team is currently reviewing your application. You will be notified via email once it has been approved.</p>
    <p style="margin: 0;">Thank you for choosing INVENTRA!</p>
  `;

  await sendEmail({
    to: email,
    subject: 'INVENTRA Registration Received',
    body,
    html: getBaseHtmlTemplate('Registration Received', content)
  });
}

export async function sendSuperAdminNotification(companyName: string, adminName: string, email: string, mobile: string, applicationRef: string): Promise<void> {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'maniyaliasadhamdan@gmail.com';
  const safeCompany = escapeHtml(companyName);
  const safeAdmin = escapeHtml(adminName);
  const safeEmail = escapeHtml(email);
  const safeMobile = escapeHtml(mobile);
  const safeRef = escapeHtml(applicationRef);

  const body = `NEW INVENTRA REGISTRATION\n\nCompany: ${companyName}\nAdmin: ${adminName}\nEmail: ${email}\nMobile: ${mobile}\nApplication: ${applicationRef}\nStatus: PENDING REVIEW\n\nPlease log in to the Super Admin dashboard to review and approve this application.`;

  const content = `
    <p style="margin: 0 0 16px 0;"><strong style="color: #0f172a;">NEW INVENTRA REGISTRATION</strong></p>
    <table width="100%" border="0" cellspacing="0" cellpadding="12" style="border-collapse: collapse; margin-top: 16px;">
      <tr><td style="border-bottom: 1px solid #e2e8f0; width: 150px;"><strong style="color: #0f172a;">Company:</strong></td><td style="border-bottom: 1px solid #e2e8f0;">${safeCompany}</td></tr>
      <tr><td style="border-bottom: 1px solid #e2e8f0;"><strong style="color: #0f172a;">Admin:</strong></td><td style="border-bottom: 1px solid #e2e8f0;">${safeAdmin}</td></tr>
      <tr><td style="border-bottom: 1px solid #e2e8f0;"><strong style="color: #0f172a;">Email:</strong></td><td style="border-bottom: 1px solid #e2e8f0;">${safeEmail}</td></tr>
      <tr><td style="border-bottom: 1px solid #e2e8f0;"><strong style="color: #0f172a;">Mobile:</strong></td><td style="border-bottom: 1px solid #e2e8f0;">${safeMobile}</td></tr>
      <tr><td style="border-bottom: 1px solid #e2e8f0;"><strong style="color: #0f172a;">Application Ref:</strong></td><td style="border-bottom: 1px solid #e2e8f0;">${safeRef}</td></tr>
    </table>
    <p style="margin-top: 24px; margin-bottom: 0;">Please log in to the Super Admin dashboard to review and approve this application.</p>
  `;

  await sendEmail({
    to: superAdminEmail,
    subject: `Action Required: New Registration - ${companyName}`,
    body,
    html: getBaseHtmlTemplate('New Registration Pending', content)
  });
}

export async function sendApprovalNotification(email: string, companyName: string, applicationRef: string | null, activationLink: string): Promise<void> {
  const safeCompany = escapeHtml(companyName);
  const safeRef = applicationRef ? escapeHtml(applicationRef) : null;
  // Make link safe for href
  const safeLink = escapeHtml(activationLink);

  const body = `Dear ${companyName},\n\nYour INVENTRA Account application has been APPROVED!\n\nPlease activate your account and set your password by clicking the secure link below:\n${activationLink}\n\nThis link is valid for 24 hours.`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We are pleased to inform you that your INVENTRA Account application has been <strong style="color: #10b981;">APPROVED</strong>!</p>
    ${safeRef ? `<p style="margin: 0 0 16px 0;"><strong style="color: #0f172a;">Application Reference:</strong> ${safeRef}</p>` : ''}
    <p style="margin: 0 0 16px 0;">Please activate your account and set your secure password to get started.</p>
  `;

  const cta = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
      <tr>
        <td align="center">
          <a href="${safeLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">Activate Account</a>
        </td>
      </tr>
    </table>
    <p style="font-size: 14px; color: #64748b; text-align: center; margin: 0;">This link will expire securely in 24 hours.</p>
  `;

  await sendEmail({
    to: email,
    subject: "Your INVENTRA Account Has Been Approved",
    body,
    html: getBaseHtmlTemplate('Account Approved', content, cta)
  });
}

export async function sendSuspensionNotification(email: string, companyName: string): Promise<void> {
  const safeCompany = escapeHtml(companyName);

  const body = `Dear ${companyName},\n\nYour INVENTRA Account has been SUSPENDED.\n\nYou will not be able to log in or access your business data.\nPlease contact the administrator for further details.`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="color: #ef4444; font-weight: bold; margin: 0 0 16px 0;">Your INVENTRA Account has been SUSPENDED.</p>
    <p style="margin: 0;">You will not be able to log in or access your business data at this time. Please contact your system administrator for further details regarding this action.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Action Required: Account Suspended',
    body,
    html: getBaseHtmlTemplate('Account Suspended', content)
  });
}

export async function sendReactivationNotification(email: string, companyName: string): Promise<void> {
  const safeCompany = escapeHtml(companyName);

  const body = `Dear ${companyName},\n\nYour INVENTRA Account has been REACTIVATED!\n\nYou can now log in to the ERP dashboard and resume managing your business.`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="margin: 0 0 16px 0;">Good news! Your INVENTRA Account has been <strong style="color: #10b981;">REACTIVATED</strong>.</p>
    <p style="margin: 0;">You can now log in to the ERP dashboard and resume managing your business operations.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Your INVENTRA Account Has Been Reactivated',
    body,
    html: getBaseHtmlTemplate('Account Reactivated', content)
  });
}

export async function sendRejectionNotification(email: string, companyName: string, reason?: string | null): Promise<void> {
  const safeCompany = escapeHtml(companyName);
  const safeReason = escapeHtml(reason);

  const reasonText = reason ? `\nReason: ${reason}` : "";
  const body = `Dear ${companyName},\n\nWe regret to inform you that your INVENTRA application was not approved for access at this time.${reasonText}`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="margin: 0 0 16px 0;">Regarding your INVENTRA registration:</p>
    <p style="margin: 0 0 16px 0;">We regret to inform you that your application was not approved for access at this time.</p>
    ${safeReason ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="16" style="background-color: #fef2f2; border-left: 4px solid #ef4444; margin: 16px 0;">
        <tr>
          <td><p style="margin:0; color: #991b1b;"><strong style="color: #0f172a;">Reason provided:</strong> ${safeReason}</p></td>
        </tr>
      </table>
    ` : ''}
    <p style="margin: 0;">If you believe this is an error or would like more information, please contact our support team.</p>
  `;

  await sendEmail({
    to: email,
    subject: "INVENTRA Registration Update",
    body,
    html: getBaseHtmlTemplate('Registration Update', content)
  });
}

export async function sendPasswordResetEmail(email: string, companyName: string, resetUrl: string): Promise<void> {
  const safeCompany = escapeHtml(companyName);
  const safeLink = escapeHtml(resetUrl);

  const body = `Dear ${companyName},\n\nWe received a request to reset your INVENTRA password.\n\nTo reset your password, please click the secure link below:\n${resetUrl}\n\nThis link will expire in 15 minutes.`;
  
  const content = `
    <p style="margin: 0 0 16px 0;">Dear <strong style="color: #0f172a;">${safeCompany}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We received a secure request to reset the password for your INVENTRA account.</p>
    <p style="margin: 0 0 16px 0;">If you did not make this request, you can safely ignore this email and your password will remain unchanged.</p>
  `;

  const cta = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
      <tr>
        <td align="center">
          <a href="${safeLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
        </td>
      </tr>
    </table>
    <p style="font-size: 14px; color: #64748b; text-align: center; margin: 0;">This secure link will expire in 15 minutes.</p>
  `;

  await sendEmail({
    to: email,
    subject: "INVENTRA Password Reset Request",
    body,
    html: getBaseHtmlTemplate('Password Reset Request', content, cta)
  });
}

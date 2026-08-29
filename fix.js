
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "backend/src/controllers/adminController.ts");
let content = fs.readFileSync(file, "utf8");

const crypto = `import crypto from "crypto";\n`;
if (!content.includes(`import crypto`)) {
  content = crypto + content;
}

const newApproveUser = `
export async function approveUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "pending") {
      return res.status(400).json({ success: false, message: "User is not pending." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() } 
    });

    await prisma.activationToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await prisma.user.update({ where: { id }, data: { status: "activation_pending" } });
    await auditLog(req.user!.userId, "USER_APPROVED", \`User #\${id} approved, activation pending\`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = \`\${frontendUrl}/activate?token=\${rawToken}\`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "User approved and activation email sent." });
  } catch (err) { next(err); }
}`;

const newRejectUser = `
export async function rejectUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "pending") {
      return res.status(400).json({ success: false, message: "User is not pending." });
    }

    await prisma.user.update({ where: { id }, data: { status: "rejected", rejectionReason: reason || null } });
    await auditLog(req.user!.userId, "USER_REJECTED", \`User #\${id} rejected: \${reason || "No reason"}\`, req);
    
    const { sendRejectionNotification } = require("../services/emailService");
    await sendRejectionNotification(user.email, user.companyName, reason);

    res.json({ success: true, message: "User rejected and email sent." });
  } catch (err) { next(err); }
}`;

const resendActivation = `
export async function resendActivation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "activation_pending") {
      return res.status(400).json({ success: false, message: "User is not pending activation." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    await prisma.activationToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await auditLog(req.user!.userId, "ACTIVATION_RESENT", \`Activation resent for User #\${id}\`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = \`\${frontendUrl}/activate?token=\${rawToken}\`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "Activation email resent." });
  } catch (err) { next(err); }
}
`;

content = content.replace(/export async function approveUser[\s\S]*?next\(err\);\s*}/, newApproveUser);
content = content.replace(/export async function rejectUser[\s\S]*?next\(err\);\s*}/, newRejectUser);

if (!content.includes("resendActivation")) {
  content += "\n" + resendActivation;
}

fs.writeFileSync(file, content, "utf8");

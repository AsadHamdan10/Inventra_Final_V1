
import re

# Fix Admin Controller
with open("backend/src/controllers/adminController.ts", "r") as f:
    admin = f.read()

import_crypto = "import crypto from \"crypto\";\n"
if "import crypto" not in admin:
    admin = import_crypto + admin

new_approve = """
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
    await auditLog(req.user!.userId, "USER_APPROVED", `User #${id} approved, activation pending`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "User approved and activation email sent." });
  } catch (err) { next(err); }
}
"""

new_reject = """
export async function rejectUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "pending") {
      return res.status(400).json({ success: false, message: "User is not pending." });
    }

    await prisma.user.update({ where: { id }, data: { status: "rejected", rejectionReason: reason || null } });
    await auditLog(req.user!.userId, "USER_REJECTED", `User #${id} rejected: ${reason || "No reason"}`, req);
    
    const { sendRejectionNotification } = require("../services/emailService");
    await sendRejectionNotification(user.email, user.companyName, reason);

    res.json({ success: true, message: "User rejected and email sent." });
  } catch (err) { next(err); }
}
"""

resend_activation = """
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

    await auditLog(req.user!.userId, "ACTIVATION_RESENT", `Activation resent for User #${id}`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "Activation email resent." });
  } catch (err) { next(err); }
}
"""

admin = re.sub(r"export async function approveUser[\s\S]*?\} catch \(err\) \{ next\(err\); \}\n\}", new_approve.strip(), admin)
admin = re.sub(r"export async function rejectUser[\s\S]*?\} catch \(err\) \{ next\(err\); \}\n\}", new_reject.strip(), admin)

if "resendActivation" not in admin:
    admin += "\n\n" + resend_activation.strip() + "\n"

with open("backend/src/controllers/adminController.ts", "w") as f:
    f.write(admin)

# Fix API Services
with open("frontend/src/services/apiServices.ts", "r") as f:
    api = f.read()

api = api.replace(
    "register: (data: any) =>\n      api.post(\"/auth/register\", data).then((r) => r.data),",
    "register: (data: any) =>\n      api.post(\"/auth/register\", data).then((r) => r.data),\n    activate: (data: any) =>\n      api.post(\"/auth/activate\", data).then((r) => r.data),"
)

api = api.replace(
    "rejectUser: (id: number) => api.post(`/admin/users/${id}/reject`).then((r) => r.data),",
    "rejectUser: (id: number, reason?: string) => api.post(`/admin/users/${id}/reject`, { reason }).then((r) => r.data),\n    resendActivation: (id: number) => api.post(`/admin/users/${id}/resend-activation`).then((r) => r.data),"
)

with open("frontend/src/services/apiServices.ts", "w") as f:
    f.write(api)

# Fix AdminUsersPage.tsx types
with open("frontend/src/pages/admin/AdminUsersPage.tsx", "r") as f:
    page = f.read()

page = page.replace("<PageHeader title=\"Platform Companies & Tenants\" subtitle=\"Manage applications and subscriptions.\" icon={<Users/>} />",
                    "<PageHeader title=\"Platform Companies & Tenants\" subtitle=\"Manage applications and subscriptions.\" />")
page = page.replace("icon={<Users className=\"h-6 w-6 text-brand-600\"/>}", "icon={Users}")
page = page.replace("icon={<UserCheck className=\"h-6 w-6 text-green-600\"/>}", "icon={UserCheck}")
page = page.replace("icon={<Clock className=\"h-6 w-6 text-yellow-600\"/>}", "icon={Clock}")
page = page.replace("icon={<Ban className=\"h-6 w-6 text-red-600\"/>}", "icon={Ban}")
page = page.replace("EmptyState icon={Users} title", "EmptyState message")

with open("frontend/src/pages/admin/AdminUsersPage.tsx", "w") as f:
    f.write(page)


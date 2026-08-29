const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "backend/src/controllers/authController.ts");
let content = fs.readFileSync(file, "utf8");

content = content.replace(/const registerSchema = z\.object\(\{[\s\S]*?\n\}\);/,
`const registerSchema = z.object({
  companyName: z.string().min(3, "Company Name must be at least 3 characters.").max(200),
  username: z.string().min(3, "Username must be at least 3 characters.").max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must contain only letters, numbers, and underscores."),
  email: z.string().email("Invalid email address.").max(150),
  mobile: z.string().regex(mobileRegex, "Mobile must be a valid 10-digit Indian mobile number."),
  businessType: z.enum(["TRADING", "MANUFACTURING", "BOTH"]).optional(),
  industry: z.string().optional().default(""),
  plan: z.string().optional().default("V1_BASIC"),
  billingCycle: z.string().optional().default("YEARLY"),
});`);

content = content.replace(/const isValid = await bcrypt\.compare\(password, user\.password\);/g, 
`if (!user.password) {
      await auditLog(user.id, "failed_login", \`Password not set for: \${username}\`, req);
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }
    const isValid = await bcrypt.compare(password, user.password);`);

content = content.replace(/user\.status !== 'approved'/g, `user.status !== 'active'`);
content = content.replace(/pending:   'Your account is pending Super Admin approval.',/g, 
`pending:   'Your account is pending Super Admin approval.',
        activation_pending: 'Your account is approved. Please check your email to activate it.',`);

const newRegister = `export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(errors)[0];
      const firstMsg   = (errors as any)[firstField]?.[0] || "Validation failed.";
      return res.status(400).json({ success: false, field: firstField, message: firstMsg });
    }

    const d = parsed.data;

    // Check username uniqueness
    const byUsername = await prisma.user.findUnique({ where: { username: d.username } });
    if (byUsername) {
      return res.status(409).json({ success: false, field: "username", message: "Username is already taken." });
    }

    // Check email uniqueness
    const byEmail = await prisma.user.findFirst({ where: { email: d.email } });
    if (byEmail) {
      return res.status(409).json({ success: false, field: "email", message: "Email is already registered." });
    }

    // Check mobile uniqueness
    const byMobile = await prisma.user.findFirst({ where: { mobileHash: blindIndex(d.mobile) } });
    if (byMobile) {
      return res.status(409).json({ success: false, field: "mobile", message: "Mobile number is already registered." });
    }

    // Check company name uniqueness
    const byCompanyName = await prisma.user.findFirst({ where: { companyName: d.companyName } });
    if (byCompanyName) {
      return res.status(409).json({ success: false, field: "companyName", message: "Company is already registered." });
    }

    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const applicationRef = \`INV-2026-\${randomStr}\`;

    const user = await prisma.user.create({
      data: {
        companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            d.plan,
      }
    });

    await auditLog(user.id, "USER_REGISTERED", \`Application \${applicationRef} submitted\`, req);
    
    // Import dynamically to avoid circular issues or just require
    const { sendRegistrationConfirmation, sendSuperAdminNotification } = require("../services/emailService");
    await sendRegistrationConfirmation(d.email, d.companyName, applicationRef);
    await sendSuperAdminNotification(d.companyName, d.username, d.email, d.mobile, applicationRef);

    res.json({ success: true, message: "Registration received.", applicationRef });
  } catch (err: any) {
    if (err.code === "P2002") {
      const rawField = err.meta?.target?.[0] || "field";
      return res.status(409).json({ success: false, field: rawField, message: \`\${rawField} already exists.\` });
    }
    next(err);
  }
}`;

content = content.replace(/export async function register[\s\S]*?next\(err\);\s*}\s*}/, newRegister);

// Ensure the new activateAccount controller exists (or append it)
if (!content.includes('activateAccount')) {
  const activateRoute = `
export async function activateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password required.' });

    // Validate token
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const activationToken = await prisma.activationToken.findUnique({ where: { tokenHash } });

    if (!activationToken) return res.status(400).json({ success: false, message: 'Invalid token.' });
    if (activationToken.usedAt) return res.status(400).json({ success: false, message: 'Token already used.' });
    if (activationToken.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Token expired.' });

    const user = await prisma.user.findUnique({ where: { id: activationToken.userId } });
    if (!user || user.status !== 'activation_pending') {
      return res.status(400).json({ success: false, message: 'Invalid account state.' });
    }

    // Pass policy check (basic example, frontend does the rest)
    if (password.length < 12) return res.status(400).json({ success: false, message: 'Password must be at least 12 characters.' });

    const hashed = await bcrypt.hash(password, 12);
    
    // Perform updates
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed, status: 'active' } }),
      prisma.activationToken.update({ where: { id: activationToken.id }, data: { usedAt: new Date() } })
    ]);

    await auditLog(user.id, 'ACCOUNT_ACTIVATED', 'User activated account', req);
    res.json({ success: true, message: 'Account activated successfully.' });
  } catch (err) { next(err); }
}
`;
  content += activateRoute;
}

fs.writeFileSync(file, content, "utf8");

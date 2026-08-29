import re

with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

# 1. Update login to check lockedUntil
locked_check = """
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await auditLog(user.id, "login_blocked", "Account locked due to brute-force", req);
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }
"""
data = data.replace(
    """if (!user) {
      await auditLog(0, 'failed_login', `User not found: ${username}`, req);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }""",
    """if (!user) {
      await auditLog(0, 'failed_login', `User not found: ${username}`, req);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }\n""" + locked_check
)

# 2. Update login to handle failure counting
fail_handler = """
      const failures = (user.failedLoginAttempts || 0) + 1;
      let lockedUntil: Date | null = null;
      if (failures >= 5) {
        lockedUntil = new Date();
        const lockoutMins = Math.min(15 * Math.pow(2, failures - 5), 1440);
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMins);
        await auditLog(user.id, "ACCOUNT_LOCKED", `Account locked until ${lockedUntil.toISOString()}`, req);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failures, lastFailedLogin: new Date(), lockedUntil }
      });
"""

data = data.replace(
    """await auditLog(user.id, "failed_login", `Password not set for: ${username}`, req);
      return res.status(401).json({ success: false, error: "Invalid username or password." });""",
    """await auditLog(user.id, "failed_login", `Password not set for: ${username}`, req);\n""" + fail_handler + """      return res.status(401).json({ success: false, error: "Invalid username or password." });"""
)

data = data.replace(
    """await auditLog(user.id, 'failed_login', `Incorrect password for: ${username}`, req);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });""",
    """await auditLog(user.id, 'failed_login', `Incorrect password for: ${username}`, req);\n""" + fail_handler + """      return res.status(401).json({ success: false, error: 'Invalid username or password.' });"""
)

# 3. Update login to clear failures on success
clear_failures = """
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lastFailedLogin: null, lockedUntil: null }
      });
      await auditLog(user.id, "ACCOUNT_UNLOCKED", "Account unlocked after successful login", req);
    }
"""
data = data.replace(
    "await auditLog(user.id, 'login', `Login: ${username}`, req);",
    "await auditLog(user.id, 'login', `Login: ${username}`, req);\n" + clear_failures
)

# 4. Add forgotPassword, resetPassword, revokeAllSessions
new_methods = """
// --- Phase 6.2 Methods ---

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) return res.status(400).json({ success: false, message: 'Username or email required.' });

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      }
    });

    res.json({ success: true, message: 'If an account matches the information provided, a password reset link has been sent.' });

    if (!user) return;

    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await auditLog(user.id, 'PASSWORD_RESET_REQUESTED', 'Password reset requested via API', req);

    const { sendPasswordResetEmail } = require('../services/emailService');
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.companyName, resetUrl);
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and new password required.' });

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetToken) return res.status(400).json({ success: false, message: 'Invalid or expired token.', code: 'INVALID_TOKEN' });
    if (resetToken.usedAt) return res.status(400).json({ success: false, message: 'Token has already been used.', code: 'USED_TOKEN' });
    if (resetToken.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Token has expired.', code: 'EXPIRED_TOKEN' });

    const user = resetToken.user;
    
    const passError = validatePassword(password, user.username, user.email);
    if (passError) return res.status(400).json({ success: false, message: passError });

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, forcePasswordChange: false, failedLoginAttempts: 0, lockedUntil: null }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    await auditLog(user.id, 'PASSWORD_RESET_COMPLETED', 'Password reset successfully', req);
    await auditLog(user.id, 'ALL_SESSIONS_REVOKED', 'All sessions revoked due to password reset', req);

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) { next(err); }
}

export async function revokeAllSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await auditLog(userId, 'ALL_SESSIONS_REVOKED', 'User manually revoked all other sessions', req);
    res.json({ success: true, message: 'All sessions have been revoked.' });
  } catch(err) { next(err); }
}
"""

if "forgotPassword" not in data:
    data += "\n" + new_methods

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)

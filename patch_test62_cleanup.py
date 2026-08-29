import re

with open("backend/test_phase_6_2_account_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "await prisma.user.deleteMany({ where: { OR: [{ username: 'test_user_62' }, { username: 'super_admin_62' }] } });",
    "await prisma.passwordResetToken.deleteMany();\n  await prisma.auditLog.deleteMany();\n  await prisma.user.deleteMany({ where: { OR: [{ username: 'test_user_62' }, { username: 'super_admin_62' }] } });"
)

with open("backend/test_phase_6_2_account_security.js", "w", encoding="utf-8") as f:
    f.write(data)


import re

with open("backend/test_phase_6_1_onboarding_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "await prisma.activationToken.deleteMany({ where: { userId: testUser.id } });",
    "await prisma.activationToken.deleteMany({ where: { userId: testUser.id } });\n      await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });"
)

with open("backend/test_phase_6_1_onboarding_security.js", "w", encoding="utf-8") as f:
    f.write(data)


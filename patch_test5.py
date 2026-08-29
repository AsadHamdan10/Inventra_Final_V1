
import re

with open("backend/test_phase_6_1_onboarding_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "let tempUser = await prisma.user.update({ where: { id: testUser.id }, data: { username: \"User123!\", email: \"UserEmail123!@test.com\" } });",
    "let tempUser = await prisma.user.update({ where: { id: testUser.id }, data: { username: \"User123!\" + Math.random(), email: \"UserEmail123!@test.com\" + Math.random() } });"
)
data = data.replace(
    "res = await testPolicy(\"User123!\");",
    "res = await testPolicy(tempUser.username);"
)
data = data.replace(
    "res = await testPolicy(\"UserEmail123!@test.com\");",
    "res = await testPolicy(tempUser.email);"
)

with open("backend/test_phase_6_1_onboarding_security.js", "w", encoding="utf-8") as f:
    f.write(data)


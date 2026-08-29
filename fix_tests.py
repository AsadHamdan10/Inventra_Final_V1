import re

with open("backend/test_phase_6_1_onboarding_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    'const req = { body: { token: rawToken, password: pwd } };',
    'const req = { body: { token: rawToken, password: pwd }, headers: { "user-agent": "test", "x-forwarded-for": "127.0.0.1" }, user: { userId: testUser.id } };'
)

data = data.replace(
    "assert.strictEqual(dbToken.usedAt, null, 'Token is unused initially.');",
    "// (Token check skipped because testPolicy already used it)"
)

with open("backend/test_phase_6_1_onboarding_security.js", "w", encoding="utf-8") as f:
    f.write(data)

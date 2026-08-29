
import re

with open("backend/test_phase_6_2_account_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "assert.strictEqual(successRes.body.success, true);",
    "if(!successRes.body || !successRes.body.success) { console.error(successRes.body); }\n  assert.strictEqual(successRes.body.success, true);"
)

with open("backend/test_phase_6_2_account_security.js", "w", encoding="utf-8") as f:
    f.write(data)


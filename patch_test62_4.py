import re

with open("backend/test_phase_6_2_account_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "status: 'approved'",
    "status: 'active'"
)

with open("backend/test_phase_6_2_account_security.js", "w", encoding="utf-8") as f:
    f.write(data)

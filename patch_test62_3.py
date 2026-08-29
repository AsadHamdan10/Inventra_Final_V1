import re

with open("backend/test_phase_6_2_account_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace(
    "tokenHash: 'dummy_hash',\n      token: 'dummy_token',",
    "token: 'dummy_token',"
)

with open("backend/test_phase_6_2_account_security.js", "w", encoding="utf-8") as f:
    f.write(data)

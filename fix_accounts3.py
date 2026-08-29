
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("type: \"ASSET\"", "accountType: \"ASSET\"")
data = data.replace("type: \"EXPENSE\"", "accountType: \"EXPENSE\"")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)



import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("gstPercent: 18", "gstRate: 18") # revert
data = data.replace("unitPrice: 500, gstRate: 18", "unitPrice: 500, gstPercent: 18") # specific fix

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)


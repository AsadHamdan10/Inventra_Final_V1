
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("assert.strictEqual(fgCheck.currentStock, 5, \"Sales completed reduces FG stock\");", "assert.strictEqual(Number(fgCheck.currentStock), 5, \"Sales completed reduces FG stock\");")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)


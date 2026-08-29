
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("entry: { userId: t1.id }", "journalEntry: { userId: t1.id }")
data = data.replace("entry: { userId: t2.id }", "journalEntry: { userId: t2.id }")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)


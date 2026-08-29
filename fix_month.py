
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("userId: t.id, name: \"2026-2027\", startDate: new Date(\"2026-04-01\"), endDate: new Date(\"2027-03-31\"), status: \"OPEN\", periodNumber: month", "userId: t.id, name: \"2026-2027\", startDate: new Date(\"2026-04-01\"), endDate: new Date(\"2027-03-31\"), status: \"OPEN\"")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)



import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "data: { fullName:" in line and "Tenant 2" in line and "const t2" not in line:
        continue
    if "});" in line and "data: { fullName:" in lines[i-1] and "Tenant 2" in lines[i-1] and "const t2" not in lines[i-1]:
        continue
    new_lines.append(line)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.writelines(new_lines)


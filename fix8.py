
with open("backend/test_phase_6_5_e2e_integration.js", "r", encoding="utf-8") as f:
    data = f.read()
data = data.replace(", gstType: 'UNREGISTERED', state: 'STATE'", "")
with open("backend/test_phase_6_5_e2e_integration.js", "w", encoding="utf-8") as f:
    f.write(data)


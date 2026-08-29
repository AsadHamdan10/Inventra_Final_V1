
with open("backend/test_phase_6_5_e2e_integration.js", "r", encoding="utf-8") as f:
    data = f.read()
data = data.replace("companyName: 'T1 Vend'", "vendorName: 'T1 Vend'")
with open("backend/test_phase_6_5_e2e_integration.js", "w", encoding="utf-8") as f:
    f.write(data)


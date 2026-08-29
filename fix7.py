
with open("backend/test_phase_6_5_e2e_integration.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("name: 'T1 Cust'", "companyName: 'T1 Cust'")
data = data.replace("name: 'T1 Vend'", "companyName: 'T1 Vend'")

with open("backend/test_phase_6_5_e2e_integration.js", "w", encoding="utf-8") as f:
    f.write(data)


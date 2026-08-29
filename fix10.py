
with open("backend/test_phase_6_5_e2e_integration.js", "r", encoding="utf-8") as f:
    data = f.read()
data = data.replace("./src/services/", "./dist/services/")
with open("backend/test_phase_6_5_e2e_integration.js", "w", encoding="utf-8") as f:
    f.write(data)


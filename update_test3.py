
import re

with open("backend/test_phase_6_1_onboarding_security.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("require(\"./src/controllers/authController\")", "require(\"./dist/controllers/authController\")")

with open("backend/test_phase_6_1_onboarding_security.js", "w", encoding="utf-8") as f:
    f.write(data)


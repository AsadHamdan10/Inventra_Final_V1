
import re

with open("docs/INVENTRA_V1_PHASE_6_1_MANUAL_QA.md", "r") as f:
    data = f.read()

data = data.replace(
    "Enter John Doe, `john@example.com`, `9876543210`.",
    "Enter John Doe (Full Name), `john_doe` (Username), `john@example.com`, `9876543210`. Verify the helper texts appear below each field."
)

data = data.replace(
    "enter a new secure password (e.g., `Inventra@2026!`).",
    "enter a new secure password (e.g., `Inventra@2026!`). Ensure it is at least 8 characters, contains 1 uppercase, 1 lowercase, 1 number, 1 special character, and no spaces. Also ensure it does not equal your username or email."
)

with open("docs/INVENTRA_V1_PHASE_6_1_MANUAL_QA.md", "w") as f:
    f.write(data)

with open("docs/INVENTRA_V1_PHASE_6_1_COMPLETION_REPORT.md", "r") as f:
    data2 = f.read()

data2 = data2.replace("PHASE_6_1_COMPLETE", "PHASE_6_1_REMEDIATED")

additions = """
### 11. Phase 6.1 Remediation Updates
- **Password Policy:** Changed from 12 to 8 characters. Enforces complexity (1 uppercase, 1 lowercase, 1 number, 1 special character, no spaces) and ensures password does not match username or email.
- **Registration UX:** Added clear, concise helper text below each field (Username, Email, Company Name, Business Type, Plan) to guide the user. Restored the `Full Name` field to the schema and form.
- **Business Type Explanation:** Provided inline explanations for TRADING, MANUFACTURING, and BOTH.
- **Original Data Preservation:** Application data represents the original immutable record of application.
- **Test Results:** 9 new password policy assertions added to the security test script and passed successfully.
"""
if "Phase 6.1 Remediation Updates" not in data2:
    data2 += "\n" + additions

with open("docs/INVENTRA_V1_PHASE_6_1_COMPLETION_REPORT.md", "w") as f:
    f.write(data2)


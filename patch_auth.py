
import re

with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

pass_validator = """function validatePassword(password: string, username: string, email: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least 1 lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least 1 number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least 1 special character.";
  if (r" ".test(password)) return "Password must not contain spaces.";
  if (password.toLowerCase() === username.toLowerCase()) return "Password cannot equal username.";
  if (password.toLowerCase() === email.toLowerCase()) return "Password cannot equal email.";
  return null;
}
"""

if "validatePassword" not in data:
    data = data.replace("export async function activateAccount", pass_validator + "\nexport async function activateAccount")

data = re.sub(r"if\s*\(password\.length\s*<\s*12\).*?;", "const passError = validatePassword(password, user.username, user.email);\n      if (passError) return res.status(400).json({ success: false, message: passError });", data)

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)


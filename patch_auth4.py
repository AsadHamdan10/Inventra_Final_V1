
import re

with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

# Fix 1: changePassword bcrypt issue
data = data.replace(
    "const isValid = await bcrypt.compare(currentPassword, user.password);",
    "if (!user.password) return res.status(400).json({ success: false, message: \"Current password is incorrect.\" });\n    const isValid = await bcrypt.compare(currentPassword, user.password);"
)

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)


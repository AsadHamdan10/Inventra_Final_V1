
import re
with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

data = data.replace("if (/\\\\s/.test(password))", "if (/\s/.test(password))")

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)


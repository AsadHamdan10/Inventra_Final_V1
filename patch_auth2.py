
import re

with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

data = data.replace("if (r\" \".test(password)) return \"Password must not contain spaces.\";", "if (/\\\\s/.test(password)) return \"Password must not contain spaces.\";")

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)


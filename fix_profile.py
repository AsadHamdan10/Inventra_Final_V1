
with open("backend/src/controllers/authController.ts", "r") as f:
    data = f.read()

data = data.replace("companyName:  z.string().min(3).max(200),", "fullName:  z.string().optional(),\n  companyName:  z.string().min(3).max(200),")

with open("backend/src/controllers/authController.ts", "w") as f:
    f.write(data)


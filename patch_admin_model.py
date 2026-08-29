
import re
with open("backend/src/controllers/adminController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("prisma.item.count", "prisma.material.count")

with open("backend/src/controllers/adminController.ts", "w", encoding="utf-8") as f:
    f.write(data)


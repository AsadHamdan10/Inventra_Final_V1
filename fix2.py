
with open("backend/src/controllers/bomController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("include: { material: true }", "include: { finishedGoodItem: true }")
data = data.replace("include: { material: true, items: { include: { component: true } }", "include: { finishedGoodItem: true, items: { include: { componentItem: true } }")

with open("backend/src/controllers/bomController.ts", "w", encoding="utf-8") as f:
    f.write(data)


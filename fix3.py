
with open("backend/src/controllers/routingController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("include: { material: true }", "include: { finishedGoodItem: true }")
data = data.replace("include: { material: true, operations: { include: { workCenter: true } }", "include: { finishedGoodItem: true, operations: { include: { workCenter: true } }")

with open("backend/src/controllers/routingController.ts", "w", encoding="utf-8") as f:
    f.write(data)


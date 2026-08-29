
with open("backend/src/controllers/productionOrderController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("include: { material: true }", "include: { item: true }")
data = data.replace("include: { material: true, components: { include: { component: true } }", "include: { item: true, components: { include: { componentItem: true } }")

with open("backend/src/controllers/productionOrderController.ts", "w", encoding="utf-8") as f:
    f.write(data)


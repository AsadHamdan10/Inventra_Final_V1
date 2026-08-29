
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("receivedQuantity: 100", "receivedQty: 100")
data = data.replace("acceptedQuantity: 100", "acceptedQty: 100")
data = data.replace("rejectedQuantity: 0", "rejectedQty: 0")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)


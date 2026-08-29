
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("// Verify Stock", "await grnService.postGoodsReceipt(t1.id, grn.id);\n    // Verify Stock")

# Also `assert.strictEqual(matCheck.currentStock, 100` -> `assert.strictEqual(Number(matCheck.currentStock), 100` because currentStock is a Decimal
data = data.replace("assert.strictEqual(matCheck.currentStock, 100", "assert.strictEqual(Number(matCheck.currentStock), 100")
data = data.replace("assert.strictEqual(layerCheck.remainingQty, 100", "assert.strictEqual(Number(layerCheck.remainingQty), 100")
data = data.replace("assert.strictEqual(Number(Number", "assert.strictEqual(Number")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)



import re

with open("backend/src/controllers/financialStatementController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("journalEntry: { date:", "journalEntry: { journalDate:")
data = data.replace("line?._sum?.debit", "(line as any)?._sum?.debit")
data = data.replace("line?._sum?.credit", "(line as any)?._sum?.credit")

with open("backend/src/controllers/financialStatementController.ts", "w", encoding="utf-8") as f:
    f.write(data)

with open("backend/src/controllers/goodsReceiptController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("orderBy: { receiptDate:", "orderBy: { grnDate:")

with open("backend/src/controllers/goodsReceiptController.ts", "w", encoding="utf-8") as f:
    f.write(data)


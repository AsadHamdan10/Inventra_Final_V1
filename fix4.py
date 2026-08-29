
import re

with open("backend/src/controllers/financialStatementController.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("entry: {", "journalEntry: {")
data = data.replace("line._sum.debit", "line?._sum?.debit")
data = data.replace("line._sum.credit", "line?._sum?.credit")

with open("backend/src/controllers/financialStatementController.ts", "w", encoding="utf-8") as f:
    f.write(data)



import re

with open("backend/src/controllers/adminController.ts", "r", encoding="utf-8") as f:
    data = f.read()

# I will completely rewrite the adminController.ts for security and separation of concerns.
# First, let's inspect its current content to understand imports and existing helpers.


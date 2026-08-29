
import re
with open("backend/prisma/schema.prisma", "r") as f:
    data = f.read()

if "fullName" not in data:
    data = data.replace(
        "username                                          String                      @unique @db.VarChar(100)",
        "fullName                                          String?                     @map(\"full_name\") @db.VarChar(150)\n    username                                          String                      @unique @db.VarChar(100)"
    )
    with open("backend/prisma/schema.prisma", "w") as f:
        f.write(data)


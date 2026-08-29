
import re
with open("backend/prisma/schema.prisma", "r") as f:
    data = f.read()

if "failedLoginAttempts" not in data:
    data = data.replace(
        "profileComplete                                   Boolean                     @default(false) @map(\"profile_complete\")",
        "profileComplete                                   Boolean                     @default(false) @map(\"profile_complete\")\n    failedLoginAttempts                               Int                         @default(0) @map(\"failed_login_attempts\")\n    lastFailedLogin                                   DateTime?                   @map(\"last_failed_login\")\n    lockedUntil                                       DateTime?                   @map(\"locked_until\")"
    )
    with open("backend/prisma/schema.prisma", "w") as f:
        f.write(data)


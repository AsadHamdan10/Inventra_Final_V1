import re

with open("backend/src/routes/auth.ts", "r") as f:
    data = f.read()

if "forgotPassword" not in data:
    data = data.replace(
        "updateProfile, activateAccount,",
        "updateProfile, activateAccount, forgotPassword, resetPassword, revokeAllSessions,"
    )
    
    data = data.replace(
        "router.post('/activate', activateAccount);",
        "router.post('/activate', activateAccount);\n\n// Phase 6.2\nrouter.post('/forgot-password', forgotPassword);\nrouter.post('/reset-password', resetPassword);\nrouter.post('/revoke-all-sessions', requireAuth, revokeAllSessions);"
    )

with open("backend/src/routes/auth.ts", "w") as f:
    f.write(data)

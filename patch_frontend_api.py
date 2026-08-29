import re

with open("frontend/src/services/apiServices.ts", "r") as f:
    data = f.read()

if "forgotPassword" not in data:
    data = data.replace(
        "activate: (data: any) => api.post(\"/auth/activate\", data).then((r) => r.data),",
        "activate: (data: any) => api.post(\"/auth/activate\", data).then((r) => r.data),\n  forgotPassword: (data: any) => api.post(\"/auth/forgot-password\", data).then((r) => r.data),\n  resetPassword: (data: any) => api.post(\"/auth/reset-password\", data).then((r) => r.data),\n  revokeAllSessions: () => api.post(\"/auth/revoke-all-sessions\").then((r) => r.data),"
    )
    with open("frontend/src/services/apiServices.ts", "w") as f:
        f.write(data)

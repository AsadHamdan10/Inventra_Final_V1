
import re

with open("frontend/src/services/apiServices.ts", "r") as f:
    data = f.read()

data = data.replace(
    "register: (data: any) =>\n    api.post(\"/auth/register\", data).then((r) => r.data),",
    "register: (data: any) =>\n    api.post(\"/auth/register\", data).then((r) => r.data),\n  activate: (data: any) => api.post(\"/auth/activate\", data).then((r) => r.data),"
)

with open("frontend/src/services/apiServices.ts", "w") as f:
    f.write(data)


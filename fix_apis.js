const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "frontend/src/services/apiServices.ts");
let content = fs.readFileSync(file, "utf8");

content = content.replace("register: (data: any) =>\n      api.post('/auth/register', data).then((r) => r.data),",
  "register: (data: any) =>\n      api.post('/auth/register', data).then((r) => r.data),\n    activate: (data: any) =>\n      api.post('/auth/activate', data).then((r) => r.data),");

content = content.replace("rejectUser: (id: number) => api.post(`/admin/users/${id}/reject`).then((r) => r.data),",
  "rejectUser: (id: number, reason?: string) => api.post(`/admin/users/${id}/reject`, { reason }).then((r) => r.data),\n    resendActivation: (id: number) => api.post(`/admin/users/${id}/resend-activation`).then((r) => r.data),");

fs.writeFileSync(file, content, "utf8");

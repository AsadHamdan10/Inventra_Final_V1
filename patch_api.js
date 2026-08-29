
const fs = require("fs");
let apiCode = fs.readFileSync("frontend/src/services/apiServices.ts", "utf8");

const saasApi = `
  // SaaS Billing (Phase 6.9)
  getSaasPlans: () => api.get("/admin/plans").then(r => r.data),
  getSaasSubscriptions: () => api.get("/admin/subscriptions").then(r => r.data),
  getSaasSubscription: (id: number) => api.get(\`/admin/subscriptions/\${id}\`).then(r => r.data),
  createSaasSubscription: (data: any) => api.post("/admin/subscriptions", data).then(r => r.data),
  cancelSaasSubscription: (id: number) => api.post(\`/admin/subscriptions/\${id}/cancel\`).then(r => r.data),
  recordSaasPayment: (id: number, data: any) => api.post(\`/admin/subscriptions/\${id}/payments\`, data).then(r => r.data),
  recordSaasCommission: (paymentId: number, data: any) => api.post(\`/admin/payments/\${paymentId}/commission\`, data).then(r => r.data),
  getSaasRevenue: () => api.get("/admin/revenue").then(r => r.data),
`;

apiCode = apiCode.replace(/getAuditLogs:.*?,/, "getAuditLogs: (page: number = 1) => api.get(`/admin/audit-logs?page=${page}`).then(r => r.data)," + saasApi);

fs.writeFileSync("frontend/src/services/apiServices.ts", apiCode, "utf8");


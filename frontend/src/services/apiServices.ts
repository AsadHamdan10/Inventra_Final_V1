import api from './api';

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  register: (data: any) =>
    api.post('/auth/register', data).then((r) => r.data),
  logout: () =>
    api.post('/auth/logout').then((r) => r.data),
  me: () =>
    api.get('/auth/me').then((r) => r.data),
  updateProfile: (data: any) =>
    api.put('/auth/profile', data).then((r) => r.data),
  changePassword: (data: any) =>
    api.put('/auth/change-password', data).then((r) => r.data),
  refresh: () =>
    api.post('/auth/refresh').then((r) => r.data),
  activate: (data: any) => 
    api.post('/auth/activate', data).then((r) => r.data),
  forgotPassword: (data: any) => 
    api.post('/auth/forgot-password', data).then((r) => r.data),
  resetPassword: (data: any) => 
    api.post('/auth/reset-password', data).then((r) => r.data),
  revokeAllSessions: () => 
    api.post('/auth/revoke-all-sessions').then((r) => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard').then((r) => r.data),
};

// ── Vendors ───────────────────────────────────────────────────
export const vendorApi = {
  list: (params?: any) => api.get('/vendors', { params }).then((r) => r.data),
  get: (id: number) => api.get(`/vendors/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/vendors', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/vendors/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/vendors/${id}`).then((r) => r.data),
  getItems: (vendorName: string) =>
    api.get('/vendors/items', { params: { vendorName } }).then((r) => r.data),
};

// ── Customers ─────────────────────────────────────────────────
export const customerApi = {
  list: (params?: any) => api.get('/customers', { params }).then((r) => r.data),
  get: (id: number) => api.get(`/customers/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/customers', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/customers/${id}`).then((r) => r.data),
};

// ── Materials ─────────────────────────────────────────────────
export const materialApi = {
  list: (params?: any) => api.get('/materials', { params }).then((r) => r.data),
  create: (data: any) => api.post('/materials', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/materials/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/materials/${id}`).then((r) => r.data),
};

// ── Purchases ─────────────────────────────────────────────────
export const purchaseApi = {
  list: (params?: any) => api.get('/purchases', { params }).then((r) => r.data),
  get: (id: number) => api.get(`/purchases/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/purchases', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/purchases/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/purchases/${id}`).then((r) => r.data),
  getLastPrice: (materialName: string) =>
    api.get('/purchases/last-price', { params: { materialName } }).then((r) => r.data),
  listGstInputBills: (params?: any) =>
    api.get('/purchases/gst-input-bills', { params }).then((r) => r.data),
  createGstInputBill: (data: any) =>
    api.post('/purchases/gst-input-bills', data).then((r) => r.data),
  deleteGstInputBill: (id: number) =>
    api.delete(`/purchases/gst-input-bills/${id}`).then((r) => r.data),

  // ── Payable payments (mirrors saleApi payment methods) ────────
  addPayment: (purchaseId: number, data: any) =>
    api.post('/purchases/payments', { ...data, purchaseId }).then((r) => r.data),
  getPayments: (purchaseId: number) =>
    api.get(`/purchases/${purchaseId}/payments`).then((r) => r.data),
  updatePayment: (paymentId: number, data: any) =>
    api.put(`/purchases/payments/${paymentId}`, data).then((r) => r.data),
  deletePayment: (paymentId: number) =>
    api.delete(`/purchases/payments/${paymentId}`).then((r) => r.data),
};

// ── Sales ─────────────────────────────────────────────────────
export const saleApi = {
  list: (params?: any) => api.get('/sales', { params }).then((r) => r.data),
  get: (id: number) => api.get(`/sales/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/sales', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/sales/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/sales/${id}`).then((r) => r.data),
  addPayment: (id: number, data: any) =>
    api.post(`/sales/${id}/payments`, data).then((r) => r.data),
  getPayments: (saleId: number) =>
    api.get(`/sales/${saleId}/payments`).then((r) => r.data),
  updatePayment: (paymentId: number, data: any) =>
    api.put(`/sales/payments/${paymentId}`, data).then((r) => r.data),
  deletePayment: (paymentId: number) =>
    api.delete(`/sales/payments/${paymentId}`).then((r) => r.data),
  receivables: (params?: any) =>
    api.get('/sales/receivables', { params }).then((r) => r.data),
};

// ── Expenses ──────────────────────────────────────────────────
export const expenseApi = {
  list: (params?: any) => api.get('/expenses', { params }).then((r) => r.data),
  create: (data: any) => api.post('/expenses', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/expenses/${id}`).then((r) => r.data),
};

// ── Investors ─────────────────────────────────────────────────
export const investorApi = {
  list: (params?: any) => api.get('/investors', { params }).then((r) => r.data),
  create: (data: any) => api.post('/investors', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/investors/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/investors/${id}`).then((r) => r.data),
};

// ── Intermediary ──────────────────────────────────────────────
export const intermediaryApi = {
  list: (params?: any) => api.get('/intermediary', { params }).then((r) => r.data),
  create: (data: any) => api.post('/intermediary', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/intermediary/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/intermediary/${id}`).then((r) => r.data),
};

// ── GST ───────────────────────────────────────────────────────
export const gstApi = {
  getCreditNotes: (params?: any) => api.get("/gst/credit-notes", { params }).then((r: any) => r.data),
  getSummary: (params?: any) => api.get("/gst/summary", { params }).then((r: any) => r.data),
  getWarnings: (params?: any) => api.get("/gst/warnings", { params }).then((r: any) => r.data),
  getGSTR1: (params?: any) => api.get("/gst/gstr1", { params }).then((r: any) => r.data),
  getGSTR3B: (params?: any) => api.get("/gst/gstr3b", { params }).then((r: any) => r.data),
  getHSNSummary: (params?: any) => api.get("/gst/hsn", { params }).then((r: any) => r.data),
  getOutward: (params?: any) => api.get("/gst/outward", { params }).then((r: any) => r.data),
  summary: (params?: any) => api.get('/gst/summary', { params }).then((r) => r.data),
  payments: (params?: any) => api.get('/gst/payments', { params }).then((r) => r.data),
  createPayment: (data: any) => api.post('/gst/payments', data).then((r) => r.data),
  deletePayment: (id: number) => api.delete(`/gst/payments/${id}`).then((r) => r.data),
};

// ── Bank ──────────────────────────────────────────────────────
export const bankApi = {
  accounts: () => api.get('/bank/accounts').then((r) => r.data),
  createAccount: (data: any) => api.post('/bank/accounts', data).then((r) => r.data),
  updateAccount: (id: number, data: any) => api.put(`/bank/accounts/${id}`, data).then((r) => r.data),
  deleteAccount: (id: number) => api.delete(`/bank/accounts/${id}`).then((r) => r.data),
  statements: (params?: any) => api.get('/bank/statements', { params }).then((r) => r.data),
  createStatement: (data: any) => api.post('/bank/statements', data).then((r) => r.data),
  updateStatement: (id: number, data: any) => api.put(`/bank/statements/${id}`, data).then((r) => r.data),
  deleteStatement: (id: number) => api.delete(`/bank/statements/${id}`).then((r) => r.data),
  summary: () => api.get('/bank/summary').then((r) => r.data),
};

// ── Reports ───────────────────────────────────────────────────
export const reportApi = {
  profit: (params?: any) =>
    api.get('/reports/profit', { params }).then((r) => r.data),
  inventory: (params?: any) =>
    api.get('/reports/inventory', { params }).then((r) => r.data),
  ledger: (params?: { from?: string; to?: string; party?: string }) =>
    api.get('/reports/ledger', { params }).then((r) => r.data),
  gst: (params?: any) =>
    api.get('/reports/gst', { params }).then((r) => r.data),
  receivables: (params?: any) =>
    api.get('/reports/receivables', { params }).then((r) => r.data),
  payables: (params?: any) =>
    api.get('/reports/payables', { params }).then((r) => r.data),
};

// ── Admin ─────────────────────────────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then(res => res.data),
  getApplications: () => api.get('/admin/applications').then(res => res.data),
  getApplicationDetail: (id: number) => api.get(`/admin/applications/${id}`).then(res => res.data),
  approveApplication: (id: number) => api.post(`/admin/users/${id}/approve`).then(res => res.data),
  rejectApplication: (id: number, reason: string) => api.post(`/admin/users/${id}/reject`, { reason }).then(res => res.data),
  resendActivation: (id: number) => api.post(`/admin/users/${id}/resend-activation`).then(res => res.data),
  getCompanies: () => api.get('/admin/companies').then(res => res.data),
  getCompanyDetail: (id: number) => api.get(`/admin/companies/${id}`).then(res => res.data),
  suspendCompany: (id: number, reason: string) => api.post(`/admin/users/${id}/suspend`, { reason }).then(res => res.data),
  reactivateCompany: (id: number) => api.post(`/admin/users/${id}/reactivate`).then(res => res.data),
  sendPasswordReset: (id: number) => api.post(`/admin/users/${id}/send-password-reset`).then(res => res.data),
  getSubscriptions: () => api.get('/admin/subscriptions').then(res => res.data),
  getSecurity: () => api.get('/admin/security').then(res => res.data),
  auditLogs: (page = 1) => api.get(`/admin/audit-logs?page=${page}`).then(res => res.data),
  getAuditLogs: (page: number = 1) => api.get(`/admin/audit-logs?page=${page}`).then(r => r.data),
  // SaaS Billing (Phase 6.9)
  getSaasPlans: () => api.get("/admin/plans").then(r => r.data),
  getSaasSubscriptions: () => api.get("/admin/subscriptions").then(r => r.data),
  getSaasSubscription: (id: number) => api.get(`/admin/subscriptions/${id}`).then(r => r.data),
  createSaasSubscription: (data: any) => api.post("/admin/subscriptions", data).then(r => r.data),
  cancelSaasSubscription: (id: number) => api.post(`/admin/subscriptions/${id}/cancel`).then(r => r.data),
  recordSaasPayment: (id: number, data: any) => api.post(`/admin/subscriptions/${id}/payments`, data).then(r => r.data),
  recordSaasCommission: (paymentId: number, data: any) => api.post(`/admin/payments/${paymentId}/commission`, data).then(r => r.data),
  getSaasRevenue: () => api.get("/admin/revenue").then(r => r.data),

};

// ── Notifications ─────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id: number) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
};

// --- STUBBED APIS FOR BUILD ---
export const eWayBillApi = {
  list: (params?: any) => api.get("/ewaybill", { params }).then((r: any) => r.data),
  generate: (sourceType: string, sourceId: number, transportData: any) => api.post("/ewaybill/generate", { sourceType, sourceId, transportData }).then((r: any) => r.data),
  cancel: (id: string, reason: string) => api.post(`/ewaybill/${id}/cancel`, { reason }).then((r: any) => r.data)
};

export const gstFilingApi = {
  dashboard: () => api.get("/gst/filing/dashboard").then((r: any) => r.data),
  getGSTR1: (params?: any) => api.get("/gst/filing/gstr1", { params }).then((r: any) => r.data),
  getGSTR3B: (params?: any) => api.get("/gst/filing/gstr3b", { params }).then((r: any) => r.data),
  markFiled: (period: string, type: string) => api.post("/gst/filing/mark-filed", { period, type }).then((r: any) => r.data),
  list: (params?: any) => api.get("/gst/filing", { params }).then((r: any) => r.data),
  get: (id: number) => api.get(`/gst/filing/${id}`).then((r: any) => r.data),
  prepare: (data: any) => api.post("/gst/filing/prepare", data).then((r: any) => r.data),
  reconcile: (id: number) => api.post(`/gst/filing/${id}/reconcile`).then((r: any) => r.data),
  markReady: (id: number) => api.post(`/gst/filing/${id}/ready`).then((r: any) => r.data),
  file: (id: number) => api.post(`/gst/filing/${id}/file`).then((r: any) => r.data),
};

// ==========================================
// PROCUREMENT
// ==========================================
export const purchaseRequisitionApi = {
  list: () => api.get("/purchase-requisitions").then(r => r.data),
  get: (id: number) => api.get(`/purchase-requisitions/${id}`).then(r => r.data),
  create: (data: any) => api.post("/purchase-requisitions", data).then(r => r.data),
  updateStatus: (id: number, status: string) => api.patch(`/purchase-requisitions/${id}/status`, { status }).then(r => r.data),
};

export const purchaseQuotationApi = {
  list: () => api.get("/purchase-quotations").then(r => r.data),
  get: (id: number) => api.get(`/purchase-quotations/${id}`).then(r => r.data),
  create: (data: any) => api.post("/purchase-quotations", data).then(r => r.data),
  updateStatus: (id: number, status: string) => api.patch(`/purchase-quotations/${id}/status`, { status }).then(r => r.data),
};

export const purchaseOrderProcurementApi = {
  list: () => api.get("/purchase-orders").then(r => r.data),
  get: (id: number) => api.get(`/purchase-orders/${id}`).then(r => r.data),
  create: (data: any) => api.post("/purchase-orders", data).then(r => r.data),
  updateStatus: (id: number, status: string) => api.patch(`/purchase-orders/${id}/status`, { status }).then(r => r.data),
};

export const goodsReceiptApi = {
  list: () => api.get("/goods-receipts").then(r => r.data),
  get: (id: number) => api.get(`/goods-receipts/${id}`).then(r => r.data),
  create: (data: any) => api.post("/goods-receipts", data).then(r => r.data),
  updateStatus: (id: number, status: string) => api.patch(`/goods-receipts/${id}/status`, { status }).then(r => r.data),
};

// ==========================================
// INVENTORY
// ==========================================
export const inventoryOperationApi = {
  listTransfers: () => api.get("/inventory/transfers").then(r => r.data),
  getTransfer: (id: number) => api.get(`/inventory/transfers/${id}`).then(r => r.data),
  createTransfer: (data: any) => api.post("/inventory/transfers", data).then(r => r.data),
};

// ==========================================
// MANUFACTURING
// ==========================================
export const bomApi = {
  list: () => api.get("/bom").then(r => r.data),
  get: (id: number) => api.get(`/bom/${id}`).then(r => r.data),
  create: (data: any) => api.post("/bom", data).then(r => r.data),
  activate: (id: number) => api.post(`/bom/${id}/activate`).then(r => r.data),
};

export const workCenterApi = {
  list: () => api.get("/work-centers").then(r => r.data),
  create: (data: any) => api.post("/work-centers", data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/work-centers/${id}`, data).then(r => r.data),
};

export const routingApi = {
  list: () => api.get("/routings").then(r => r.data),
  get: (id: number) => api.get(`/routings/${id}`).then(r => r.data),
  create: (data: any) => api.post("/routings", data).then(r => r.data),
  activate: (id: number) => api.post(`/routings/${id}/activate`).then(r => r.data),
};

export const productionOrderApi = {
  list: () => api.get("/production-orders").then(r => r.data),
  get: (id: number) => api.get(`/production-orders/${id}`).then(r => r.data),
  create: (data: any) => api.post("/production-orders", data).then(r => r.data),
  release: (id: number) => api.post(`/production-orders/${id}/release`).then(r => r.data),
  startExecution: (id: number) => api.post(`/production-orders/${id}/start-execution`).then(r => r.data),
  issueMaterial: (id: number, data: any) => api.post(`/production-orders/${id}/issue-material`, data).then(r => r.data),
  recordOutput: (id: number, data: any) => api.post(`/production-orders/${id}/record-output`, data).then(r => r.data),
};

// ==========================================
// FINANCE
// ==========================================
export const financialStatementApi = {
  getTrialBalance: (params?: any) => api.get("/finance/trial-balance", { params }).then(r => r.data),
  getProfitLoss: (params?: any) => api.get("/finance/profit-loss", { params }).then(r => r.data),
  getBalanceSheet: (params?: any) => api.get("/finance/balance-sheet", { params }).then(r => r.data),
};
export const warehouseApi = {
  list: () => api.get('/warehouses').then((r) => r.data),
  get: (id: number) => api.get(`/warehouses/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/warehouses', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/warehouses/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/warehouses/${id}`).then((r) => r.data),
};

export const stockTransferApi = {
  update: (id: number, data: any) => api.put(`/inventory/transfers/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/inventory/transfers/${id}`).then(r => r.data),
  list: () => api.get('/inventory/transfers').then(r => r.data),
  get: (id: number) => api.get(`/inventory/transfers/${id}`).then(r => r.data),
  create: (data: any) => api.post('/inventory/transfers', data).then(r => r.data),
};
export const chartOfAccountsApi = {
  list: () => api.get('/coa').then(r => r.data),
  create: (data: any) => api.post('/coa', data).then(r => r.data),
};

export const journalEntryApi = {
  list: (params?: any) => api.get('/journals', { params }).then(r => r.data),
  create: (data: any) => api.post('/journals', data).then(r => r.data),
  get: (id: number) => api.get(`/journals/${id}`).then(r => r.data),
};

export const accountingReportsApi = {
  getTrialBalance: (params?: any) => api.get('/reports/trial-balance', { params }).then(r => r.data),
  getProfitLoss: (params?: any) => api.get('/reports/profit-loss', { params }).then(r => r.data),
  getBalanceSheet: (params?: any) => api.get('/reports/balance-sheet', { params }).then(r => r.data),
  getDayBook: (params?: any) => api.get('/reports/day-book', { params }).then(r => r.data),
};
export const stockAdjustmentApi = {
  update: (id: number, data: any) => api.put(`/inventory/adjustments/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/inventory/adjustments/${id}`).then(r => r.data),
  list: () => api.get('/inventory/adjustments').then(r => r.data),
  get: (id: number) => api.get(`/inventory/adjustments/${id}`).then(r => r.data),
  create: (data: any) => api.post('/inventory/adjustments', data).then(r => r.data),
};



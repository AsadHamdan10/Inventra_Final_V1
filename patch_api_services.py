
import re

with open("frontend/src/services/apiServices.ts", "r", encoding="utf-8") as f:
    data = f.read()

exports = """// ==========================================
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
"""

with open("frontend/src/services/apiServices.ts", "a", encoding="utf-8") as f:
    f.write("\n" + exports)



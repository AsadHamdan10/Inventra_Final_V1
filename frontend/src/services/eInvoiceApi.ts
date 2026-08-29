import api from './api';

// 🖨️ E-Invoice 🖨️
export const eInvoiceApi = {
  generateForSale: (saleId: number) => api.post(`/einvoice/sale/${saleId}/generate`).then((r) => r.data),
  generateForReturn: (returnId: number) => api.post(`/einvoice/return/${returnId}/generate`).then((r) => r.data),
  retryFailed: (id: number) => api.post(`/einvoice/${id}/retry`).then((r) => r.data),
  cancel: (id: number, data: any) => api.post(`/einvoice/${id}/cancel`, data).then((r) => r.data),
  getBySale: (saleId: number) => api.get(`/einvoice/sale/${saleId}`).then((r) => r.data),
  getByReturn: (returnId: number) => api.get(`/einvoice/return/${returnId}`).then((r) => r.data),
};

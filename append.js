const fs = require('fs');
let api = fs.readFileSync('frontend/src/services/apiServices.ts', 'utf8');

const additions = \
// --- STUBBED APIS FOR BUILD ---
export const eWayBillApi = {
  list: (params?: any) => api.get('/ewaybill', { params }).then(r => r.data),
  generate: (data: any) => api.post('/ewaybill/generate', data).then(r => r.data),
  cancel: (id: string, data: any) => api.post(\\\/ewaybill/\\\/cancel\\\, data).then(r => r.data)
};

export const gstFilingApi = {
  dashboard: () => api.get('/gst/filing/dashboard').then(r => r.data),
  getGSTR1: (params?: any) => api.get('/gst/filing/gstr1', { params }).then(r => r.data),
  getGSTR3B: (params?: any) => api.get('/gst/filing/gstr3b', { params }).then(r => r.data),
  markFiled: (period: string, type: string) => api.post('/gst/filing/mark-filed', { period, type }).then(r => r.data)
};
\;

// Add missing gstApi methods
api = api.replace('export const gstApi = {', 'export const gstApi = {\\n  getCreditNotes: (params?: any) => api.get(\\'/gst/credit-notes\\', { params }).then(r => r.data),\\n  getSummary: (params?: any) => api.get(\\'/gst/summary\\', { params }).then(r => r.data),\\n  getWarnings: (params?: any) => api.get(\\'/gst/warnings\\', { params }).then(r => r.data),\\n  getGSTR1: (params?: any) => api.get(\\'/gst/gstr1\\', { params }).then(r => r.data),\\n  getGSTR3B: (params?: any) => api.get(\\'/gst/gstr3b\\', { params }).then(r => r.data),\\n  getHSNSummary: (params?: any) => api.get(\\'/gst/hsn\\', { params }).then(r => r.data),\\n  getOutward: (params?: any) => api.get(\\'/gst/outward\\', { params }).then(r => r.data),');

if (!api.includes('eWayBillApi')) {
  api += '\\n' + additions;
}

// Re-add register activate since we checked out apiServices!
api = api.replace(
    'register: (data: any) =>\\n    api.post(\\'/auth/register\\', data).then((r) => r.data),',
    'register: (data: any) =>\\n    api.post(\\'/auth/register\\', data).then((r) => r.data),\\n  activate: (data: any) =>\\n    api.post(\\'/auth/activate\\', data).then((r) => r.data),'
);
api = api.replace(
    'rejectUser: (id: number) => api.post(\/admin/users/\/reject\).then((r) => r.data),',
    'rejectUser: (id: number, reason?: string) => api.post(\/admin/users/\/reject\, { reason }).then((r) => r.data),\\n  resendActivation: (id: number) => api.post(\/admin/users/\/resend-activation\).then((r) => r.data),'
);

fs.writeFileSync('frontend/src/services/apiServices.ts', api, 'utf8');


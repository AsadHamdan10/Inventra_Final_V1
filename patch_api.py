import re

with open("frontend/src/services/apiServices.ts", "r", encoding="utf-8") as f:
    data = f.read()

# Replace adminApi
old_admin_api = """export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then(res => res.data),
  getUsers: () => api.get('/admin/users').then(res => res.data),
  approveUser: (id: number) => api.post(`/admin/users/${id}/approve`).then(res => res.data),
  rejectUser: (id: number, reason: string) => api.post(`/admin/users/${id}/reject`, { reason }).then(res => res.data),
  suspendUser: (id: number) => api.post(`/admin/users/${id}/suspend`).then(res => res.data),
  resetPassword: (id: number, password: string) => api.post(`/admin/users/${id}/reset-password`, { password }).then(res => res.data),
  getAuditLogs: (page = 1) => api.get(`/admin/audit-logs?page=${page}`).then(res => res.data),
  resendActivation: (id: number) => api.post(`/admin/users/${id}/resend-activation`).then(res => res.data),
};"""

new_admin_api = """export const adminApi = {
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
  getAuditLogs: (page = 1) => api.get(`/admin/audit-logs?page=${page}`).then(res => res.data),
};"""

if "getApplicationDetail" not in data:
    data = data.replace(old_admin_api, new_admin_api)

with open("frontend/src/services/apiServices.ts", "w", encoding="utf-8") as f:
    f.write(data)

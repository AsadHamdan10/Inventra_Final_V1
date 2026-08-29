
import re

with open("frontend/src/services/apiServices.ts", "r") as f:
    api = f.read()

additions = """
// --- STUBBED APIS FOR BUILD ---
export const eWayBillApi = {
  list: (params?: any) => api.get("/ewaybill", { params }).then((r: any) => r.data),
  generate: (data: any) => api.post("/ewaybill/generate", data).then((r: any) => r.data),
  cancel: (id: string, data: any) => api.post(`/ewaybill/${id}/cancel`, data).then((r: any) => r.data)
};

export const gstFilingApi = {
  dashboard: () => api.get("/gst/filing/dashboard").then((r: any) => r.data),
  getGSTR1: (params?: any) => api.get("/gst/filing/gstr1", { params }).then((r: any) => r.data),
  getGSTR3B: (params?: any) => api.get("/gst/filing/gstr3b", { params }).then((r: any) => r.data),
  markFiled: (period: string, type: string) => api.post("/gst/filing/mark-filed", { period, type }).then((r: any) => r.data)
};
"""

gst_methods = """export const gstApi = {
  getCreditNotes: (params?: any) => api.get("/gst/credit-notes", { params }).then((r: any) => r.data),
  getSummary: (params?: any) => api.get("/gst/summary", { params }).then((r: any) => r.data),
  getWarnings: (params?: any) => api.get("/gst/warnings", { params }).then((r: any) => r.data),
  getGSTR1: (params?: any) => api.get("/gst/gstr1", { params }).then((r: any) => r.data),
  getGSTR3B: (params?: any) => api.get("/gst/gstr3b", { params }).then((r: any) => r.data),
  getHSNSummary: (params?: any) => api.get("/gst/hsn", { params }).then((r: any) => r.data),
  getOutward: (params?: any) => api.get("/gst/outward", { params }).then((r: any) => r.data),"""

api = api.replace("export const gstApi = {", gst_methods)

if "eWayBillApi" not in api:
    api += "\n" + additions

api = api.replace(
    "register: (data: any) =>\n    api.post(\"/auth/register\", data).then((r) => r.data),",
    "register: (data: any) =>\n    api.post(\"/auth/register\", data).then((r) => r.data),\n  activate: (data: any) =>\n    api.post(\"/auth/activate\", data).then((r) => r.data),"
)
api = api.replace(
    "rejectUser: (id: number) => api.post(`/admin/users/${id}/reject`).then((r) => r.data),",
    "rejectUser: (id: number, reason?: string) => api.post(`/admin/users/${id}/reject`, { reason }).then((r) => r.data),\n  resendActivation: (id: number) => api.post(`/admin/users/${id}/resend-activation`).then((r) => r.data),"
)

with open("frontend/src/services/apiServices.ts", "w") as f:
    f.write(api)


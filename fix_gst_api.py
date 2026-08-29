
import re

with open("frontend/src/services/apiServices.ts", "r", encoding="utf-8") as f:
    data = f.read()

pattern = re.compile(r"export const gstFilingApi = \{.*?\};", re.DOTALL)

new_gst_api = """export const gstFilingApi = {
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
};"""

data = pattern.sub(new_gst_api, data)

# also fix eWayBillApi generate to accept any number of args, or change it to take (sourceType, sourceId, data)
pattern2 = re.compile(r"export const eWayBillApi = \{.*?\};", re.DOTALL)

new_ewaybill_api = """export const eWayBillApi = {
  list: (params?: any) => api.get("/ewaybill", { params }).then((r: any) => r.data),
  generate: (sourceType: string, sourceId: number, transportData: any) => api.post("/ewaybill/generate", { sourceType, sourceId, transportData }).then((r: any) => r.data),
  cancel: (id: string, data: any) => api.post(`/ewaybill/${id}/cancel`, data).then((r: any) => r.data)
};"""

data = pattern2.sub(new_ewaybill_api, data)

with open("frontend/src/services/apiServices.ts", "w", encoding="utf-8") as f:
    f.write(data)


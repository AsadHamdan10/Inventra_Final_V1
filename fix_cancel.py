
with open("frontend/src/services/apiServices.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("cancel: (id: string, data: any) => api.post(`/ewaybill/${id}/cancel`, data).then((r: any) => r.data)", "cancel: (id: string, reason: string) => api.post(`/ewaybill/${id}/cancel`, { reason }).then((r: any) => r.data)")

with open("frontend/src/services/apiServices.ts", "w", encoding="utf-8") as f:
    f.write(data)


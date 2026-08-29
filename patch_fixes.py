import re
import os

# 1. Fix AppLayout imports
with open("frontend/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    app_layout = f.read()
if "CreditCard" not in app_layout:
    app_layout = app_layout.replace(
        "import { LayoutDashboard,", 
        "import { LayoutDashboard, CreditCard, FileText, Activity, Shield, Users, Building2,"
    )
with open("frontend/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(app_layout)

# 2. Fix App.tsx removing AdminUsersPage completely
with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    app_tsx = f.read()
app_tsx = app_tsx.replace("import AdminUsersPage from './pages/admin/AdminUsersPage';", "")
app_tsx = app_tsx.replace('<Route path="users" element={<AdminUsersPage />} />', "")
with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(app_tsx)

# Delete AdminUsersPage.tsx
if os.path.exists("frontend/src/pages/admin/AdminUsersPage.tsx"):
    os.remove("frontend/src/pages/admin/AdminUsersPage.tsx")

# 3. Fix AdminAuditLogsPage keepPreviousData & types
with open("frontend/src/pages/admin/AdminAuditLogsPage.tsx", "r", encoding="utf-8") as f:
    admin_logs = f.read()
admin_logs = admin_logs.replace("keepPreviousData: true", "/* keepPreviousData: true */")
admin_logs = admin_logs.replace("(data?.logs", "((data as any)?.logs")
admin_logs = admin_logs.replace("data?.page", "(data as any)?.page")
admin_logs = admin_logs.replace("data.logs.length", "(data as any).logs.length")
admin_logs = admin_logs.replace("data.limit", "(data as any).limit")
with open("frontend/src/pages/admin/AdminAuditLogsPage.tsx", "w", encoding="utf-8") as f:
    f.write(admin_logs)

# 4. Fix AdminDashboardPage color "slate" -> "gray" or omit
with open("frontend/src/pages/admin/AdminDashboardPage.tsx", "r", encoding="utf-8") as f:
    admin_dash = f.read()
admin_dash = admin_dash.replace('color="slate"', 'color="purple"')
with open("frontend/src/pages/admin/AdminDashboardPage.tsx", "w", encoding="utf-8") as f:
    f.write(admin_dash)

# 5. Fix Tenant AuditLogsPage.tsx
with open("frontend/src/pages/reports/AuditLogsPage.tsx", "r", encoding="utf-8") as f:
    tenant_logs = f.read()
tenant_logs = tenant_logs.replace("adminApi.auditLogs", "adminApi.getAuditLogs") 
with open("frontend/src/pages/reports/AuditLogsPage.tsx", "w", encoding="utf-8") as f:
    f.write(tenant_logs)

with open("frontend/src/services/apiServices.ts", "r", encoding="utf-8") as f:
    api_srv = f.read()
if "auditLogs: " not in api_srv:
    api_srv = api_srv.replace(
        "getAuditLogs:", 
        "auditLogs: (page = 1) => api.get(`/admin/audit-logs?page=${page}`).then(res => res.data),\n  getAuditLogs:"
    )
with open("frontend/src/services/apiServices.ts", "w", encoding="utf-8") as f:
    f.write(api_srv)

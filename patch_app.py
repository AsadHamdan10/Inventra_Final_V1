import re

with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    data = f.read()

# Replace admin page imports
old_imports = """// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';"""

new_imports = """// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from './pages/admin/AdminApplicationDetailPage';
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage';
import AdminCompanyDetailPage from './pages/admin/AdminCompanyDetailPage';
import AdminSecurityPage from './pages/admin/AdminSecurityPage';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';"""

if "AdminApplicationsPage" not in data:
    data = data.replace(old_imports, new_imports)

# Replace admin routes
old_routes = """          {/* Super Admin routes */}
          <Route path="/admin" element={<AdminRoute><AppLayout isAdmin /></AdminRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
          </Route>"""

new_routes = """          {/* Super Admin routes */}
          <Route path="/admin" element={<AdminRoute><AppLayout isAdmin /></AdminRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="applications" element={<AdminApplicationsPage />} />
            <Route path="applications/:id" element={<AdminApplicationDetailPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="security" element={<AdminSecurityPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>"""

if "applications/:id" not in data:
    data = data.replace(old_routes, new_routes)

with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(data)

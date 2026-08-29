import re

with open("frontend/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    data = f.read()

old_admin_nav = """const adminNav: NavSection[] = [
  {
    title: 'Admin Panel',
    items: [
      { to: '/admin',       icon: Shield, label: 'Dashboard'    },
      { to: '/admin/users', icon: Users,  label: 'Manage Users' },
    ],
  },
];"""

new_admin_nav = """const adminNav: NavSection[] = [
  {
    title: 'Command Center',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Applications',
    items: [
      { to: '/admin/applications', icon: FileText, label: 'Applications' },
    ],
  },
  {
    title: 'Tenants',
    items: [
      { to: '/admin/companies', icon: Building2, label: 'Companies' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
    ],
  },
  {
    title: 'Security',
    items: [
      { to: '/admin/security', icon: Shield, label: 'Security Center' },
      { to: '/admin/audit-logs', icon: Activity, label: 'Audit Logs' },
    ],
  },
];"""

data = data.replace(old_admin_nav, new_admin_nav)

# Check if icons are imported
if "CreditCard" not in data:
    data = data.replace(
        "import { LayoutDashboard,",
        "import { LayoutDashboard, CreditCard, FileText, Activity,"
    )

with open("frontend/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(data)

import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, Building2,
  TrendingUp, TrendingDown, Calculator, Wallet, UserCheck, Repeat2,
  Landmark, BookOpen, ClipboardList, Settings, LogOut, Bell,
  ChevronDown, Menu, X, Sun, Moon, Shield, BookMarked, Palette, Percent, Scroll, CreditCard, Activity} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Footer from '../ui/Footer';
import { authApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const tenantNav: NavSection[] = [
  {
    title: 'Main',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    title: 'Masters',
    items: [
      { to: '/vendors',   icon: Building2, label: 'Vendors'   },
      { to: '/customers', icon: Users,     label: 'Customers' },
      { to: '/materials', icon: Package,   label: 'Materials' },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { to: '/purchases', icon: ShoppingCart, label: 'Purchases' },
      { to: '/sales',     icon: FileText,     label: 'Sales'     },
      { to: '/quotation', icon: Scroll,       label: 'Quotation' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/reports/profit',        icon: TrendingUp,  label: 'Profit & Loss' },
      { to: '/inventory',             icon: Package,     label: 'Inventory'     },
      { to: '/receivables',           icon: TrendingUp,  label: 'Receivables'   },
      { to: '/payables',              icon: TrendingDown, label: 'Payables'     },
      { to: '/reports/day-book',      icon: BookOpen,    label: 'Day Book'      },
      { to: '/reports/party-ledger',  icon: BookMarked,  label: 'Party Ledger'  },
    ],
  },
  {
      title: 'Compliance & GST',
      items: [
        { to: '/gst',          icon: Calculator, label: 'GST Summary'   },
        { to: '/gst-payments', icon: Wallet,     label: 'GST Payments'  },
        { to: '/ewaybill',     icon: FileText,   label: 'E-Way Bill'    },
        { to: '/gst/filing',   icon: Scroll,     label: 'GST Filing'    },
      ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/expenses',        icon: Wallet,    label: 'Expenses'        },
      { to: '/investors',       icon: UserCheck, label: 'Investors'       },
      { to: '/intermediary',    icon: Repeat2,   label: 'Intermediary'    },
      { to: '/bank-statements', icon: Landmark,  label: 'Bank Statements' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/calculate-sale-price', icon: Percent, label: 'Calculate Sale Price' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/company-profile',  icon: Settings, label: 'Company Profile'     },
      { to: '/invoice-settings', icon: Palette,  label: 'Invoice Formatting'  },
    ],
  },
];

const adminNav: NavSection[] = [
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
];

interface AppLayoutProps {
  isAdmin?: boolean;
}

export default function AppLayout({ isAdmin = false }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('inventra-dark') === 'true');

  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('inventra-dark', String(dark));
  }, [dark]);

  useEffect(() => {
  const el = document.getElementById('page-scroll-container');

  if (el) {
    el.scrollTo({
      top: 0,
      behavior: 'instant' as ScrollBehavior,
    });
  }
}, [location.pathname]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    navigate('/login');
    toast.success('Logged out successfully.');
  };

  const navSections = isAdmin ? adminNav : tenantNav;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 flex flex-col
          bg-gray-900 dark:bg-gray-950 border-r border-gray-800
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo/inventra-logo.png"
              alt="Inventra ERP"
              className="h-12 w-auto object-contain"
            />
            <div>
              <div className="text-white font-bold text-lg tracking-tight">Inventra ERP</div>
              <div className="text-gray-500 text-xs mt-0.5">Simplifying Business Operations</div>
            </div>
          </div>
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Company badge */}
        <div className="px-4 py-2.5 border-b border-gray-800">
          <div className="inline-flex items-center gap-1.5 bg-brand-900/50 text-brand-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            {isAdmin ? <Shield size={10} /> : <Building2 size={10} />}
            <span className="truncate max-w-[160px]">
              {isAdmin ? 'Super Admin' : user?.companyName}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="mb-1">
              <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/' || item.to === '/admin'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors
                     border-l-2 mx-1 rounded-r-lg
                     ${isActive
                       ? 'bg-brand-900/40 text-brand-400 border-brand-500'
                       : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border-transparent'
                     }`
                  }
                >
                  <item.icon size={15} className="flex-shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-800 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.companyName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-200 font-medium truncate">{user?.companyName}</div>
              <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
          <button
  onClick={handleLogout}
  className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-red-400
             transition-colors py-1.5 px-1 rounded-md hover:bg-gray-800"
>
  <LogOut size={13} className="flex-shrink-0" />
  Sign Out
</button>

          <div className="pt-1 border-t border-gray-800/60">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <span className="text-gray-500 font-semibold">Inventra ERP</span> v1.0.7
              <br />
              Developed &amp; Maintained by
              <br />
              <span className="text-gray-500">Asad Hamdan</span>
              {' '}·{' '}
              <a href="tel:+919342509303" className="text-gray-600 hover:text-indigo-400 transition-colors">
                +91 93425 09303
              </a>
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <img
              src="/assets/logo/inventra-logo.png"
              alt="Inventra ERP"
              className="h-8 w-auto object-contain"
              style={{ maxHeight: '34px' }}
            />
          </div>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Toggle dark mode"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative">
              <Bell size={16} />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.companyName?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
                {user?.companyName}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
  id="page-scroll-container"
  className="flex-1 overflow-y-auto p-4 md:p-6 pb-2 print-scroll-fix"
>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}

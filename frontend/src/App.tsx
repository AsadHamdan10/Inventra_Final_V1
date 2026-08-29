import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import api from './services/api';
import PurchaseRegisterPrint from './pages/purchases/PurchaseRegisterPrint';
import SalesRegisterPrint from './pages/sales/SalesRegisterPrint';
import CompanyProfilePage from './pages/company/CompanyProfilePage';
import InvoiceSettingsPage from './pages/invoiceTemplates/InvoiceSettingsPage';
import ProfitRegisterPrint from './pages/reports/ProfitRegisterPrint';
import PartyLedgerPrint from './pages/reports/PartyLedgerPrint';
import LedgerPrint from './pages/reports/LedgerPrint';
import GstSummaryPrint from './pages/gst/GstSummaryPrint';
import GstPaymentPrint from './pages/gst/GstPaymentPrint';
import EWayBillPage from './pages/compliance/EWayBillPage';
import GstFilingDashboard from './pages/gst/GstFilingDashboard';
import ExpensePrint from './pages/expenses/ExpensePrint';
import IntermediaryPrint from './pages/intermediary/IntermediaryPrint';
import BankStatementPrint from './pages/bankstatements/BankStatementPrint';
import ReceivablePrint from './pages/receivables/ReceivablePrint';
import PayablePrint from './pages/payables/PayablePrint';


import BomPage from "./pages/manufacturing/BomPage";
import ProductionOrderPage from "./pages/manufacturing/ProductionOrderPage";
import { TrialBalancePage } from "./pages/finance/TrialBalancePage";
import { ProfitLossPage } from "./pages/finance/ProfitLossPage";
import { BalanceSheetPage } from "./pages/finance/BalanceSheetPage";
// Layouts

import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';

// PWA update system (isolated module — see src/components/pwa/)
import { UpdateProvider } from './components/pwa/UpdateContext';
import UpdateDialog from './components/pwa/UpdateDialog';

// PWA install manager (isolated module — see src/components/pwa/)
import { InstallProvider } from './components/pwa/InstallContext';
import InstallBanner from './components/pwa/InstallBanner';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ActivationPage from './pages/auth/ActivationPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';

// App pages
import DashboardPage from './pages/dashboard/DashboardPage';
import VendorsPage from './pages/vendors/VendorsPage';
import CustomersPage from './pages/customers/CustomersPage';
import MaterialsPage from './pages/materials/MaterialsPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import SalesPage from './pages/sales/SalesPage';
import QuotationPage from './pages/quotation/QuotationPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import InventoryPage from './pages/inventory/InventoryPage';
import WarehousePage from './pages/inventory/WarehousePage';
import StockTransferPage from './pages/inventory/StockTransferPage';
import StockAdjustmentPage from './pages/inventory/StockAdjustmentPage';
import PurchaseRequisitionsPage from './pages/procurement/PurchaseRequisitionsPage';
import PurchaseQuotationsPage from './pages/procurement/PurchaseQuotationsPage';
import PurchaseOrdersPage from './pages/procurement/PurchaseOrdersPage';
import GoodsReceiptNotesPage from './pages/procurement/GoodsReceiptNotesPage';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import WorkCentersPage from './pages/manufacturing/WorkCentersPage';
import RoutingsPage from './pages/manufacturing/RoutingsPage';
import MaterialIssuePage from './pages/manufacturing/MaterialIssuePage';
import ProductionOutputPage from './pages/manufacturing/ProductionOutputPage';
import ReceivablesPage from './pages/receivables/ReceivablesPage';
import PayablesPage from './pages/payables/PayablesPage';
import InvestorsPage from './pages/investors/InvestorsPage';
import IntermediaryPage from './pages/intermediary/IntermediaryPage';
import BankStatementsPage from './pages/bankstatements/BankStatementsPage';
import GstPage from './pages/gst/GstPage';
import GstPaymentsPage from './pages/gst/GstPaymentsPage';
import ProfitPage from './pages/reports/ProfitPage';
import LedgerPage from './pages/reports/LedgerPage';
import PartyLedgerPage from './pages/reports/PartyLedgerPage';
import AuditLogsPage from './pages/reports/AuditLogsPage';
import CalculateSalePricePage from './pages/tools/CalculateSalePricePage';

// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from './pages/admin/AdminApplicationDetailPage';
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage';
import AdminCompanyDetailPage from './pages/admin/AdminCompanyDetailPage';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import AdminSecurityPage from './pages/admin/AdminSecurityPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated, user } = useAuthStore();
  if (!isHydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.forcePasswordChange) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function TenantRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  }, [accessToken]);

  useEffect(() => {
    const dark = localStorage.getItem('inventra-dark') === 'true';
    if (dark) document.documentElement.classList.add('dark');
  }, []);

  return (
    <UpdateProvider>
      <InstallProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/register"        element={<RegisterPage />} />
              <Route path="/activate"        element={<ActivationPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Super Admin routes */}
                          <Route path="/admin" element={<AdminRoute><AppLayout isAdmin /></AdminRoute>}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="applications" element={<AdminApplicationsPage />} />
                <Route path="applications/:id" element={<AdminApplicationDetailPage />} />
                <Route path="companies" element={<AdminCompaniesPage />} />
                <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
                <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                <Route path="security" element={<AdminSecurityPage />} />
                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              </Route>

            {/* Standalone Print Routes */}
            <Route path="/purchase-register-print"  element={<TenantRoute><PurchaseRegisterPrint /></TenantRoute>} />
            <Route path="/sales-register-print"     element={<TenantRoute><SalesRegisterPrint /></TenantRoute>} />
            <Route path="/profit-register-print"    element={<TenantRoute><ProfitRegisterPrint /></TenantRoute>} />
            <Route path="/party-ledger-print"       element={<TenantRoute><PartyLedgerPrint /></TenantRoute>} />
            <Route path="/ledger-print"             element={<TenantRoute><LedgerPrint /></TenantRoute>} />
            <Route path="/gst-summary-print"        element={<TenantRoute><GstSummaryPrint /></TenantRoute>} />
            <Route path="/gst-payment-print"        element={<TenantRoute><GstPaymentPrint /></TenantRoute>} />
            <Route path="/expense-print"            element={<TenantRoute><ExpensePrint /></TenantRoute>} />
            <Route path="/intermediary-print"       element={<TenantRoute><IntermediaryPrint /></TenantRoute>} />
            <Route path="/bank-statement-print"     element={<TenantRoute><BankStatementPrint /></TenantRoute>} />
            <Route path="/receivable-print"         element={<TenantRoute><ReceivablePrint /></TenantRoute>} />
            <Route path="/payable-print"            element={<TenantRoute><PayablePrint /></TenantRoute>} />

            {/* Tenant routes */}
              <Route path="/" element={<TenantRoute><AppLayout /></TenantRoute>}>
              {/* Inventory Routes */}
              <Route path="/inventory/warehouses" element={<TenantRoute><WarehousePage /></TenantRoute>} />
              <Route path="/inventory/stock-transfer" element={<TenantRoute><StockTransferPage /></TenantRoute>} />
              <Route path="/inventory/stock-adjustment" element={<TenantRoute><StockAdjustmentPage /></TenantRoute>} />

              {/* Procurement Routes */}
              <Route path="/procurement/requisitions" element={<TenantRoute><PurchaseRequisitionsPage /></TenantRoute>} />
              <Route path="/procurement/quotations" element={<TenantRoute><PurchaseQuotationsPage /></TenantRoute>} />
              <Route path="/procurement/orders" element={<TenantRoute><PurchaseOrdersPage /></TenantRoute>} />
              <Route path="/procurement/grn" element={<TenantRoute><GoodsReceiptNotesPage /></TenantRoute>} />

              {/* Accounting Routes */}
              <Route path="/accounting/coa" element={<TenantRoute><ChartOfAccountsPage /></TenantRoute>} />
              <Route path="/accounting/journals" element={<TenantRoute><JournalEntriesPage /></TenantRoute>} />

              {/* Manufacturing Extensions */}
              <Route path="/manufacturing/work-centers" element={<TenantRoute><WorkCentersPage /></TenantRoute>} />
              <Route path="/manufacturing/routings" element={<TenantRoute><RoutingsPage /></TenantRoute>} />
              <Route path="/manufacturing/material-issue" element={<TenantRoute><MaterialIssuePage /></TenantRoute>} />
              <Route path="/manufacturing/production-output" element={<TenantRoute><ProductionOutputPage /></TenantRoute>} />
              <Route index element={<DashboardPage />} />
              <Route path="vendors"               element={<VendorsPage />} />
              <Route path="customers"             element={<CustomersPage />} />
              <Route path="materials"             element={<MaterialsPage />} />
              <Route path="purchases"             element={<PurchasesPage />} />
              <Route path="sales"                 element={<SalesPage />} />
              <Route path="quotation"             element={<QuotationPage />} />
              <Route path="expenses"              element={<ExpensesPage />} />
              <Route path="inventory"             element={<InventoryPage />} />
              <Route path="receivables"           element={<ReceivablesPage />} />
              <Route path="payables"              element={<PayablesPage />} />
              <Route path="investors"             element={<InvestorsPage />} />
              <Route path="intermediary"          element={<IntermediaryPage />} />
              <Route path="ewaybill"              element={<EWayBillPage />} />
              <Route path="gst/filing"            element={<GstFilingDashboard />} />
              <Route path="bank-statements"       element={<BankStatementsPage />} />
              <Route path="gst"                   element={<GstPage />} />
              <Route path="gst-payments"          element={<GstPaymentsPage />} />
              <Route path="company-profile"       element={<CompanyProfilePage />} />
              <Route path="invoice-settings"      element={<InvoiceSettingsPage />} />
              <Route path="audit-logs"            element={<AuditLogsPage />} />
              <Route path="calculate-sale-price"  element={<CalculateSalePricePage />} />

              {/* Reports */}
              
              
              {/* Manufacturing */}
              <Route path="manufacturing/bom" element={<BomPage />} />
              <Route path="manufacturing/production-orders" element={<ProductionOrderPage />} />

              {/* Financial Statements */}
              <Route path="finance/trial-balance" element={<TrialBalancePage />} />
              <Route path="finance/profit-loss"   element={<ProfitLossPage />} />
              <Route path="finance/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="reports/profit"        element={<ProfitPage />} />

              <Route path="reports/day-book"      element={<LedgerPage />} />
              <Route path="reports/party-ledger"  element={<PartyLedgerPage />} />

              {/* Legacy redirect */}
              <Route path="reports/ledger" element={<Navigate to="/reports/day-book" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>

        <InstallBanner />
      </InstallProvider>

      <UpdateDialog />
    </UpdateProvider>
  );
}







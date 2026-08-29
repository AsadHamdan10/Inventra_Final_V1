import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner } from '../../components/ui';
import { format } from 'date-fns';

export default function AdminCompaniesPage() {
  const { data: companies, isLoading } = useQuery({ queryKey: ['admin-companies'], queryFn: adminApi.getCompanies });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Companies (Tenants)" subtitle="Manage active and suspended operational SaaS tenants" />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-semibold">Tenant ID</th>
                <th className="p-4 font-semibold">Company Name</th>
                <th className="p-4 font-semibold">Contact</th>
                <th className="p-4 font-semibold">Plan</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Created</th>
                <th className="p-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {(companies || []).map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors">
                  <td className="p-4 text-sm font-mono text-slate-500">#{c.id}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">{c.tradingName || c.companyName}</div>
                    {c.tradingName && <div className="text-xs text-slate-500">Legal: {c.companyName}</div>}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-700 dark:text-slate-300">{c.email}</div>
                    <div className="text-xs text-slate-500">{c.mobile}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                    {c.plan}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {format(new Date(c.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/admin/companies/${c.id}`}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-md hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      360° View
                    </Link>
                  </td>
                </tr>
              ))}
              {!companies?.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No active tenants found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStyle = () => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStyle()}`}>
      {status.toUpperCase()}
    </span>
  );
}

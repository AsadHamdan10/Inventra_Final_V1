import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner } from '../../components/ui';
import { format } from 'date-fns';

export default function AdminApplicationsPage() {
  const { data: apps, isLoading } = useQuery({ queryKey: ['admin-apps'], queryFn: adminApi.getApplications });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" subtitle="Review and manage pending SaaS applications" />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-semibold">Ref & Company</th>
                <th className="p-4 font-semibold">Applicant</th>
                <th className="p-4 font-semibold">Business</th>
                <th className="p-4 font-semibold">Submitted</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {(apps || []).map((app: any) => (
                <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">{app.companyName}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{app.applicationRef}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-700 dark:text-slate-300">{app.fullName}</div>
                    <div className="text-xs text-slate-500">{app.email}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-700 dark:text-slate-300">{app.businessType || '-'}</div>
                    <div className="text-xs text-slate-500">{app.plan}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {format(new Date(app.submittedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={app.user?.status || app.originalStatus} />
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/admin/applications/${app.id}`}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-md hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {!apps?.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No applications found.</td>
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
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'activation_pending': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'rejected': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStyle()}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

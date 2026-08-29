import { useQuery } from '@tanstack/react-query';
import { Users, Clock, UserCheck, Ban, Activity, Building, FileText, XCircle } from 'lucide-react';
import { adminApi } from '../../services/apiServices';
import { PageHeader, StatCard, Spinner } from '../../components/ui';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.dashboard });
  if (isLoading) return <Spinner/>;
  if (!data) return null;

  const t = data.tenants;

  return (
    <div className="space-y-6">
      <PageHeader title="Command Center" subtitle="INVENTRA V1 Platform Overview" />

      {/* Tenants & Apps Overview */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Platform Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Active Companies" value={t.totalActive} icon={Building} color="blue" />
          <StatCard label="Pending Applications" value={t.pending} icon={Clock} color="amber" />
          <StatCard label="Activation Pending" value={t.activationPending} icon={UserCheck} color="indigo" />
          <StatCard label="Suspended" value={t.suspended} icon={Ban} color="red" />
          <StatCard label="Rejected" value={t.rejected} icon={XCircle} color="purple" />
        </div>
      </div>

      {t.pending > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4">
          <p className="text-amber-800 dark:text-amber-300 font-semibold text-sm">
            You have {t.pending} application(s) awaiting review. 
            <Link to="/admin/applications" className="ml-2 underline">Review Applications →</Link>
          </p>
        </div>
      )}

      {/* Finance/Sub Disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-4 flex gap-3">
        <Activity className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
        <p className="text-blue-800 dark:text-blue-300 font-medium text-sm">
          Platform financial analytics (MRR/ARR) will be available after the SaaS billing and platform finance modules are implemented. Payment gateways are currently not integrated.
        </p>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
          <Activity size={16} />
          Recent Platform Activity
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {(data.recentLogs || []).map((log: any) => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-brand-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {log.user?.companyName || "System"}
                  </span>
                  <span className="mx-2 text-slate-400">•</span>
                  <span className="font-medium text-brand-600 dark:text-brand-400">{log.action}</span>
                  {log.details && (
                    <span className="text-slate-500 dark:text-slate-400 ml-2 text-xs border-l border-slate-300 dark:border-slate-700 pl-2">
                      {log.details}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            </div>
          ))}
          {data.recentLogs?.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}

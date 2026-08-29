import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, authApi } from '../../services/apiServices';
import { PageHeader, Spinner, StatCard } from '../../components/ui';
import { format } from 'date-fns';
import { Shield, ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSecurityPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-security'], queryFn: adminApi.getSecurity });

  if (isLoading) return <Spinner />;
  if (!data || !data.account) return null;

  const handleRevokeSessions = async () => {
    if (!window.confirm('WARNING: This will instantly log out ALL active users across the entire platform, including you. Proceed?')) return;
    try {
      await authApi.revokeAllSessions();
      toast.success('All sessions revoked.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error('Failed to revoke sessions');
    }
  };

  const a = data.account;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Security Center" subtitle="Super Admin security management and global actions" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <Shield size={16} /> My Admin Account
            </h3>
            <div className="space-y-3">
              <Field label="Username" value={a.username} />
              <Field label="Email" value={a.email} />
              <Field label="Created At" value={format(new Date(a.createdAt), 'PP')} />
              <Field label="Failed Login Attempts" value={a.failedLoginAttempts} />
              <Field label="Lock Status" value={
                a.lockedUntil && new Date(a.lockedUntil) > new Date() 
                  ? <span className="text-red-500 font-medium">LOCKED until {format(new Date(a.lockedUntil), 'HH:mm')}</span> 
                  : <span className="text-green-600 font-medium">Clear</span>
              } />
              {a.lastFailedLogin && <Field label="Last Failed Login" value={format(new Date(a.lastFailedLogin), 'PPpp')} />}
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-red-800 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle size={18} /> Global Panic Action
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              Revoke all active sessions across the entire INVENTRA platform immediately. This will force all logged-in users, including Super Admins, to log in again.
            </p>
            <button 
              onClick={handleRevokeSessions}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-sm shadow-sm transition-colors"
            >
              Revoke All Global Sessions
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
            <ShieldAlert size={16} /> Recent Admin Security Events
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {(data.recentSecurityEvents || []).map((log: any) => (
              <div key={log.id} className="py-3">
                <div className="font-medium text-sm text-slate-900 dark:text-white">{log.action}</div>
                {log.details && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.details}</div>}
                <div className="text-xs text-slate-400 mt-1">{format(new Date(log.createdAt), 'PPpp')}</div>
              </div>
            ))}
            {data.recentSecurityEvents?.length === 0 && (
              <div className="py-4 text-center text-slate-500 text-sm">No recent security events.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function Field({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">{value || '-'}</div>
    </div>
  );
}

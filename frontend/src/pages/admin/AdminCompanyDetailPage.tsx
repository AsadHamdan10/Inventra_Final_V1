import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner } from '../../components/ui';
import { Ban, CheckCircle, KeyRound, Building, Activity, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AdminCompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const { data, isLoading } = useQuery({ 
    queryKey: ['admin-company', id], 
    queryFn: () => adminApi.getCompanyDetail(Number(id)),
    enabled: !!id
  });

  if (isLoading) return <Spinner />;
  if (!data || !data.company) return <div>Tenant not found.</div>;

  const { company, erpOverview } = data;
  const snapshot = company.applicationSnapshot;

  const handleSuspend = async () => {
    if (!suspendReason) return toast.error('Suspension reason is required');
    if (!window.confirm('WARNING: Suspend this company? This will instantly revoke all their active sessions and lock them out of INVENTRA.')) return;
    try {
      setLoadingAction(true);
      await adminApi.suspendCompany(company.id, suspendReason);
      toast.success('Tenant suspended');
      setIsSuspending(false);
      qc.invalidateQueries({ queryKey: ['admin-company', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Suspension failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm('Reactivate this tenant?')) return;
    try {
      setLoadingAction(true);
      await adminApi.reactivateCompany(company.id);
      toast.success('Tenant reactivated');
      qc.invalidateQueries({ queryKey: ['admin-company', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reactivation failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!window.confirm('Send a secure password reset email to this tenant?')) return;
    try {
      setLoadingAction(true);
      await adminApi.sendPasswordReset(company.id);
      toast.success('Password reset email sent securely.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <PageHeader title="Tenant 360°" subtitle={`Tenant ID: #${company.id}`} />
        <button onClick={() => navigate('/admin/companies')} className="text-sm text-brand-600 hover:underline">
          &larr; Back to Companies
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {company.status === 'active' ? (
          !isSuspending ? (
            <button onClick={() => setIsSuspending(true)} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 font-medium rounded-md text-sm transition-colors">
              <Ban size={16} /> Suspend Tenant...
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Reason for suspension..." 
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                className="w-64 px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
              />
              <button onClick={handleSuspend} disabled={loadingAction} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm">Confirm Suspend</button>
              <button onClick={() => setIsSuspending(false)} disabled={loadingAction} className="px-4 py-2 text-slate-500 text-sm">Cancel</button>
            </div>
          )
        ) : (
          <button onClick={handleReactivate} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm">
            <CheckCircle size={16} /> Reactivate Tenant
          </button>
        )}
        <div className="flex-1" />
        <button onClick={handlePasswordReset} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-md text-sm transition-colors border border-slate-200 dark:border-slate-700">
          <KeyRound size={16} /> Send Password Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <ShieldAlert size={16} className="text-slate-500" />
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Original Application</h3>
            </div>
            <div className="p-4 space-y-4">
              <Field label="Application Ref" value={snapshot?.applicationRef} />
              <Field label="Original Company Name" value={snapshot?.companyName} />
              <Field label="Original Business Type" value={snapshot?.businessType} />
              <Field label="Original Industry" value={snapshot?.industry} />
              <Field label="Original Plan" value={snapshot?.plan} />
            </div>
          </div>

          <SectionCard title="Account Security">
            <Field label="Status" value={<span className={`uppercase font-bold ${company.status === 'suspended' ? 'text-red-500' : 'text-green-500'}`}>{company.status}</span>} />
            <Field label="Username" value={company.username} />
            <Field label="Created At" value={format(new Date(company.createdAt), 'PP')} />
            <Field label="Lock Status" value={
              company.lockedUntil && new Date(company.lockedUntil) > new Date() 
                ? <span className="text-red-500 font-medium">LOCKED until {format(new Date(company.lockedUntil), 'HH:mm')}</span> 
                : <span className="text-green-600 font-medium">Clear</span>
            } />
            <Field label="Failed Attempts" value={company.failedLoginAttempts} />
          </SectionCard>
        </div>

        {/* Right Col */}
        <div className="space-y-6 lg:col-span-2">
          
          <SectionCard title={<><Building size={16} className="inline mr-2" /> Current Profile (Operational)</>}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Trading Name" value={company.tradingName} />
              <Field label="Legal Name" value={company.legalName} />
              <Field label="Website" value={company.website} />
              <Field label="Contact Email" value={company.email} />
              <Field label="Contact Phone" value={company.mobile} />
              <Field label="Alternate Phone" value={company.alternatePhone} />
              <Field label="Currency" value={company.currency} />
              <Field label="Timezone" value={company.timezone} />
            </div>
          </SectionCard>

          <SectionCard title={<><Activity size={16} className="inline mr-2" /> ERP Operational Overview</>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ErpStat label="Sales Invoices" value={erpOverview.sales} />
              <ErpStat label="Purchase Orders" value={erpOverview.purchases} />
              <ErpStat label="Inventory Items" value={erpOverview.items} />
              <ErpStat label="Warehouses" value={erpOverview.warehouses} />
              <ErpStat label="Journal Entries" value={erpOverview.journals} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>Financial monetary totals require authoritative aggregation services.</span>
              <span>SaaS Billing/MRR calculation not yet implemented.</span>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center">{title}</h3>
      {children}
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

function ErpStat({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</div>
    </div>
  );
}

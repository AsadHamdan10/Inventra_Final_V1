import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner } from '../../components/ui';
import { CheckCircle, XCircle, Mail, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AdminApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const { data: app, isLoading } = useQuery({ 
    queryKey: ['admin-app', id], 
    queryFn: () => adminApi.getApplicationDetail(Number(id)),
    enabled: !!id
  });

  if (isLoading) return <Spinner />;
  if (!app) return <div>Application not found.</div>;

  const status = app.user?.status || app.originalStatus;
  const userId = app.userId; // we act on the user ID for approvals

  const handleApprove = async () => {
    if (!window.confirm('Approve this application and send activation email?')) return;
    try {
      setLoadingAction(true);
      await adminApi.approveApplication(userId);
      toast.success('Application approved');
      qc.invalidateQueries({ queryKey: ['admin-app', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return toast.error('Rejection reason is required');
    try {
      setLoadingAction(true);
      await adminApi.rejectApplication(userId, rejectReason);
      toast.success('Application rejected');
      setIsRejecting(false);
      qc.invalidateQueries({ queryKey: ['admin-app', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResend = async () => {
    if (!window.confirm('Invalidate old tokens and resend activation email?')) return;
    try {
      setLoadingAction(true);
      await adminApi.resendActivation(userId);
      toast.success('Activation email resent');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <PageHeader title="Application 360°" subtitle={`Reference: ${app.applicationRef}`} />
        <button onClick={() => navigate('/admin/applications')} className="text-sm text-brand-600 hover:underline">
          &larr; Back to Applications
        </button>
      </div>

      {status === 'pending' && (
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {!isRejecting ? (
            <>
              <button onClick={handleApprove} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm transition-colors disabled:opacity-50">
                <CheckCircle size={16} /> Approve & Activate
              </button>
              <button onClick={() => setIsRejecting(true)} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium rounded-md text-sm transition-colors disabled:opacity-50">
                <XCircle size={16} /> Reject...
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Reason for rejection..." 
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <button onClick={handleReject} disabled={loadingAction} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-sm disabled:opacity-50">
                Confirm Reject
              </button>
              <button onClick={() => setIsRejecting(false)} disabled={loadingAction} className="px-4 py-2 text-slate-500 text-sm">Cancel</button>
            </div>
          )}
        </div>
      )}

      {status === 'activation_pending' && (
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-sm text-slate-600 dark:text-slate-400">Waiting for user to click activation link.</span>
          <button onClick={handleResend} disabled={loadingAction} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm transition-colors disabled:opacity-50">
            <Mail size={16} /> Resend Activation Email
          </button>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-blue-500 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">ORIGINAL APPLICATION — IMMUTABLE</h4>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              This data represents the exact snapshot provided during registration and cannot be modified.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Application Details">
          <Field label="Status" value={<span className="uppercase font-semibold">{status}</span>} />
          <Field label="Submitted At" value={format(new Date(app.submittedAt), 'PPpp')} />
          {app.reviewedAt && <Field label="Reviewed At" value={format(new Date(app.reviewedAt), 'PPpp')} />}
          {app.rejectionReason && <Field label="Rejection Reason" value={<span className="text-red-500">{app.rejectionReason}</span>} />}
        </SectionCard>

        <SectionCard title="Original Applicant">
          <Field label="Full Name" value={app.fullName} />
          <Field label="Username" value={app.username} />
          <Field label="Email" value={app.email} />
          <Field label="Mobile" value={app.mobile} />
        </SectionCard>

        <SectionCard title="Original Business">
          <Field label="Company Name" value={app.companyName} />
          <Field label="Business Type" value={app.businessType || '-'} />
          <Field label="Industry" value={app.industry || '-'} />
        </SectionCard>

        <SectionCard title="Plan Request">
          <Field label="Requested Plan" value={app.plan} />
          <Field label="Billing Cycle" value={app.billingCycle} />
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
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

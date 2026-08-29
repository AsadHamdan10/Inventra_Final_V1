import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner, Modal } from '../../components/ui';
import { CreditCard, IndianRupee, TrendingUp, AlertCircle, Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [payModal, setPayModal] = useState(false);
  const [commModal, setCommModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const { data: rev, isLoading: loadingRev } = useQuery({ queryKey: ['saas-revenue'], queryFn: adminApi.getSaasRevenue });
  const { data: subs, isLoading: loadingSubs } = useQuery({ queryKey: ['saas-subs'], queryFn: adminApi.getSaasSubscriptions });

  const payMut = useMutation({
    mutationFn: (d: any) => adminApi.recordSaasPayment(selectedSub.id, d),
    onSuccess: () => { toast.success('Payment recorded'); setPayModal(false); qc.invalidateQueries({queryKey: ['saas-subs']}); qc.invalidateQueries({queryKey: ['saas-revenue']}); },
    onError: (e:any) => toast.error(e.response?.data?.error || 'Failed to record payment')
  });

  const commMut = useMutation({
    mutationFn: (d: any) => adminApi.recordSaasCommission(selectedPayment.id, d),
    onSuccess: () => { toast.success('Commission recorded'); setCommModal(false); qc.invalidateQueries({queryKey: ['saas-subs']}); qc.invalidateQueries({queryKey: ['saas-revenue']}); },
    onError: (e:any) => toast.error(e.response?.data?.error || 'Failed to record commission')
  });

  if (loadingRev || loadingSubs) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="SaaS Financials & Subscriptions" subtitle="Platform Revenue Management" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Gross Collected</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{rev?.totalCollected?.toLocaleString()}</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full"><IndianRupee className="text-blue-600" /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">₹{rev?.outstanding?.toLocaleString()}</p>
          </div>
          <div className="bg-red-100 p-3 rounded-full"><AlertCircle className="text-red-600" /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Marketer Commission</p>
            <p className="text-2xl font-bold text-orange-600">₹{rev?.marketerCommission?.toLocaleString()}</p>
          </div>
          <div className="bg-orange-100 p-3 rounded-full"><TrendingUp className="text-orange-600" /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Net Platform Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">₹{rev?.netRevenue?.toLocaleString()}</p>
          </div>
          <div className="bg-emerald-100 p-3 rounded-full"><CreditCard className="text-emerald-600" /></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="p-4">Tenant</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Period</th>
              <th className="p-4">Final Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs?.map((s:any) => (
              <tr key={s.id}>
                <td className="p-4 font-medium">{s.user.companyName}</td>
                <td className="p-4 text-slate-500">{s.plan.name}</td>
                <td className="p-4 text-slate-500">{format(new Date(s.startDate), 'MMM yy')} - {format(new Date(s.endDate), 'MMM yy')}</td>
                <td className="p-4 font-semibold">₹{s.finalAmount}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.status==='PAID'?'bg-emerald-100 text-emerald-800':s.status==='UNPAID'?'bg-red-100 text-red-800':'bg-yellow-100 text-yellow-800'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-4 flex gap-2">
                  <button className="btn-secondary text-sm px-3 py-1" onClick={()=>{ setSelectedSub(s); setPayModal(true); }}>Receive Pay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={payModal} onClose={()=>setPayModal(false)} title="Record Manual Payment">
        <form onSubmit={(e)=>{
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          payMut.mutate(Object.fromEntries(fd));
        }} className="space-y-4">
          <p className="text-sm text-slate-600">Record a payment received outside of INVENTRA.</p>
          <div><label className="block text-sm mb-1">Amount Received</label><input type="number" name="amountReceived" className="w-full p-2 border rounded" required /></div>
          <div><label className="block text-sm mb-1">Payment Date</label><input type="date" name="paymentDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" required /></div>
          <div><label className="block text-sm mb-1">Method</label>
            <select name="paymentMethod" className="w-full p-2 border rounded">
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Transaction Ref</label><input type="text" name="transactionReference" className="w-full p-2 border rounded" /></div>
          <div className="flex justify-end pt-4"><button type="submit" className="btn-primary">Record Payment</button></div>
        </form>
      </Modal>
    </div>
  );
}

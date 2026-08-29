const fs = require("fs");
const adminUsers = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, PauseCircle, KeyRound, Users, Clock, UserCheck, Ban, Mail, Phone, Eye, RefreshCw } from "lucide-react";
import { adminApi } from "../../services/apiServices";
import { PageHeader, Modal, Field, Spinner, EmptyState, StatusBadge, StatCard } from "../../components/ui";
import toast from "react-hot-toast";
import api from "../../services/api";

type Filter = "all" | "pending" | "activation_pending" | "active" | "rejected" | "suspended";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [resetModal, setResetModal] = useState<{open:boolean;id:number|null;name:string}>({open:false,id:null,name:""});
  const [detailModal, setDetailModal] = useState<{open:boolean;user:any|null}>({open:false,user:null});
  const [rejectModal, setRejectModal] = useState<{open:boolean;id:number|null}>({open:false,id:null});
  
  const [newPassword, setNewPassword] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: adminApi.users });

  const approve = useMutation({
    mutationFn: (id: number) => adminApi.approveUser(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:["admin-users"]}); qc.invalidateQueries({queryKey:["admin-dashboard"]}); toast.success("User approved and email sent."); setDetailModal({open:false,user:null}); },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.message || "Failed."),
  });

  const reject = useMutation({
    mutationFn: (data: {id: number, reason: string}) => adminApi.rejectUser(data.id, data.reason),
    onSuccess: () => { qc.invalidateQueries({queryKey:["admin-users"]}); toast.success("User rejected."); setRejectModal({open:false,id:null}); setDetailModal({open:false,user:null}); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed."),
  });

  const suspend = useMutation({
    mutationFn: (id: number) => adminApi.suspendUser(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:["admin-users"]}); toast.success("User suspended."); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed."),
  });

  const resend = useMutation({
    mutationFn: (id: number) => adminApi.resendActivation(id),
    onSuccess: () => { toast.success("Activation email resent."); },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.message || "Failed."),
  });

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error("Min 8 characters."); return; }
    if (!resetModal.id) return;
    try {
      await api.post(\`/admin/users/\${resetModal.id}/reset-password\`, { password: newPassword });
      setResetModal({open:false,id:null,name:""}); setNewPassword("");
      toast.success("Password reset.");
    } catch (e: any) { toast.error(e.response?.data?.error||"Failed."); }
  };

  const filtered = users.filter((u: any) => {
    const mf = filter === "all" || u.status === filter;
    const ms = !search || [u.companyName,u.username,u.email].some(f=>f?.toLowerCase().includes(search.toLowerCase()));
    return mf && ms;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Companies & Tenants" subtitle="Manage applications and subscriptions." />
      
      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
          <StatCard title="Active" value={stats.activeUsers} icon={UserCheck} />
          <StatCard title="Pending" value={stats.pendingUsers} icon={Clock} />
          <StatCard title="Suspended" value={stats.suspendedUsers} icon={Ban} />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 flex justify-between items-center space-x-4">
        <div className="flex gap-2">
          {(["all","pending","activation_pending","active","rejected","suspended"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={\`px-3 py-1 text-sm rounded-full capitalize \${filter === f ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}\`}>
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} className="w-64 input" />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {isLoading ? <div className="p-12 flex justify-center"><Spinner/></div> : filtered.length === 0 ? <EmptyState message="No companies found" icon={Users} /> : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company & Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{u.companyName}</div>
                    <div className="text-sm text-gray-500">{u.username} • {u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.plan || "V1_BASIC"}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={u.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => setDetailModal({open:true, user: u})} className="text-brand-600 hover:text-brand-900 bg-brand-50 p-1.5 rounded" title="View Detail"><Eye className="h-4 w-4"/></button>
                    {u.status === "pending" && <button onClick={() => approve.mutate(u.id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded" title="Approve"><CheckCircle className="h-4 w-4"/></button>}
                    {u.status === "pending" && <button onClick={() => setRejectModal({open:true,id:u.id})} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded" title="Reject"><XCircle className="h-4 w-4"/></button>}
                    {u.status === "activation_pending" && <button onClick={() => resend.mutate(u.id)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded" title="Resend Activation"><RefreshCw className="h-4 w-4"/></button>}
                    {u.status === "active" && <button onClick={() => suspend.mutate(u.id)} className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 p-1.5 rounded" title="Suspend"><PauseCircle className="h-4 w-4"/></button>}
                    {u.status === "active" && <button onClick={() => setResetModal({open:true,id:u.id,name:u.companyName})} className="text-purple-600 hover:text-purple-900 bg-purple-50 p-1.5 rounded" title="Reset Password"><KeyRound className="h-4 w-4"/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={resetModal.open} onClose={() => setResetModal({open:false,id:null,name:""})} title={\`Reset Password: \${resetModal.name}\`}>
        <Field label="New Temporary Password"><input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="input" /></Field>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={() => setResetModal({open:false,id:null,name:""})} className="btn-secondary">Cancel</button>
          <button onClick={resetPassword} className="btn-primary">Confirm Reset</button>
        </div>
      </Modal>

      <Modal open={rejectModal.open} onClose={() => setRejectModal({open:false,id:null})} title="Reject Application">
        <Field label="Reason (Optional)"><textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} className="input" rows={3}></textarea></Field>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={() => setRejectModal({open:false,id:null})} className="btn-secondary">Cancel</button>
          <button onClick={() => reject.mutate({id: rejectModal.id!, reason: rejectReason})} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Reject</button>
        </div>
      </Modal>

      <Modal open={detailModal.open} onClose={() => setDetailModal({open:false,user:null})} title="Application Details">
        {detailModal.user && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-500 uppercase">Business</h4>
                <p className="font-medium text-lg dark:text-white mt-1">{detailModal.user.companyName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Ref: {detailModal.user.applicationRef || "N/A"}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Plan: {detailModal.user.plan || "V1_BASIC"}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-500 uppercase">Contact</h4>
                <p className="font-medium text-lg dark:text-white mt-1">{detailModal.user.username}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 mt-2"><Mail className="h-3 w-3"/> {detailModal.user.email}</p>
                {detailModal.user.mobile && <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1"><Phone className="h-3 w-3"/> {detailModal.user.mobile}</p>}
              </div>
            </div>
            {detailModal.user.status === "pending" && (
              <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                <button onClick={() => approve.mutate(detailModal.user.id)} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex justify-center items-center gap-2"><CheckCircle className="h-5 w-5"/> Approve & Send Link</button>
                <button onClick={() => setRejectModal({open:true,id:detailModal.user.id})} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex justify-center items-center gap-2"><XCircle className="h-5 w-5"/> Reject</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}`;

fs.writeFileSync("frontend/src/pages/admin/AdminUsersPage.tsx", adminUsers, "utf8");

const register = `import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { authApi } from "../../services/apiServices";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: "", email: "", mobile: "", companyName: "", businessType: "TRADING", industry: "", plan: "V1_BASIC", billingCycle: "YEARLY"
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [applicationRef, setApplicationRef] = useState("");

  const nextStep = () => {
    setError("");
    if (step === 1) {
      if (!form.username || !form.email || !form.mobile) { setError("Please fill all required fields."); return; }
    }
    if (step === 2) {
      if (!form.companyName || !form.businessType) { setError("Please fill all required fields."); return; }
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await authApi.register(form);
      setApplicationRef(res.applicationRef || "INV-XXXXXX");
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Application Submitted</h2>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Your application reference</p>
          <div className="mt-2 text-2xl font-mono font-bold text-brand-600 dark:text-brand-400">{applicationRef}</div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">We received your application. We will review it and send an email once your application is approved.</p>
          <div className="mt-8"><Link to="/login" className="text-brand-600 hover:text-brand-500 font-medium">Return to Login</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">INVENTRA</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Start your journey</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -mt-px w-full h-0.5 bg-gray-200 dark:bg-gray-700"></div>
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className={\`relative flex items-center justify-center w-8 h-8 rounded-full \${step >= num ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400 dark:bg-gray-700"} font-bold\`}>{num}</div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-8 font-medium">
            <span>You</span><span>Business</span><span>Plan</span><span>Review</span>
          </div>

          {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}

          <form onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Information</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div className="flex justify-end pt-4">
                  <button type="button" onClick={nextStep} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">Continue <ArrowRight className="ml-2 h-4 w-4" /></button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Business Details</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Type <span className="text-red-500">*</span></label>
                  <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg">
                    <option value="TRADING">Trading</option>
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Industry (Optional)</label>
                  <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={prevStep} className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"><ArrowLeft className="mr-2 h-4 w-4" /> Back</button>
                  <button type="button" onClick={nextStep} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">Continue <ArrowRight className="ml-2 h-4 w-4" /></button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Subscription Plan</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className={\`border-2 rounded-lg p-4 cursor-pointer \${form.plan === "V1_BASIC" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-200 dark:border-gray-700"}\`} onClick={() => setForm({...form, plan: "V1_BASIC"})}>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-900 dark:text-white">Basic ERP</span><span className="text-brand-600 font-bold">Free Trial</span></div>
                    <p className="text-sm text-gray-500 mt-2">Core Trading & Finance.</p>
                  </div>
                  <div className={\`border-2 rounded-lg p-4 cursor-pointer \${form.plan === "V1_MANUFACTURING" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-200 dark:border-gray-700"}\`} onClick={() => setForm({...form, plan: "V1_MANUFACTURING"})}>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-900 dark:text-white">Manufacturing ERP</span><span className="text-brand-600 font-bold">Custom</span></div>
                    <p className="text-sm text-gray-500 mt-2">Full Production & Execution.</p>
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={prevStep} className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"><ArrowLeft className="mr-2 h-4 w-4" /> Back</button>
                  <button type="button" onClick={nextStep} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">Review <ArrowRight className="ml-2 h-4 w-4" /></button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Review & Submit</h3>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-3">
                  <div><span className="block text-xs text-gray-500 uppercase">Applicant</span><span className="font-medium">{form.username} ({form.email})</span></div>
                  <div><span className="block text-xs text-gray-500 uppercase">Business</span><span className="font-medium">{form.companyName} - {form.businessType}</span></div>
                  <div><span className="block text-xs text-gray-500 uppercase">Plan</span><span className="font-medium">{form.plan === "V1_BASIC" ? "Basic ERP" : "Manufacturing ERP"}</span></div>
                </div>
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={prevStep} disabled={loading} className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"><ArrowLeft className="mr-2 h-4 w-4" /> Back</button>
                  <button type="submit" disabled={loading} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50">{loading ? "Submitting..." : "Submit Application"}</button>
                </div>
              </div>
            )}
          </form>
          
          {step === 1 && (
            <div className="mt-6 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Already have an account? </span>
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">Log in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`;

fs.writeFileSync("frontend/src/pages/auth/RegisterPage.tsx", register, "utf8");


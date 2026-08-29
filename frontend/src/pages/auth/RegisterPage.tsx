import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { authApi } from "../../services/apiServices";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: "", username: "", email: "", mobile: "", companyName: "", businessType: "TRADING", industry: "", plan: "V1_BASIC", billingCycle: "YEARLY"
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
              <div key={num} className={`relative flex items-center justify-center w-8 h-8 rounded-full ${step >= num ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400 dark:bg-gray-700"} font-bold`}>{num}</div>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Choose carefully — your username cannot be changed later.</p>
                  <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Used for activation and account security notifications.</p>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Enter your official business name carefully — this becomes your primary company identity after application submission.</p>
                  <input type="text" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Type <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">Choose carefully — this determines the ERP modules available to your company.</p>
                  <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 text-lg">
                    <option value="TRADING">Trading</option>
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="BOTH">Both</option>
                  </select>

                  <div className="mt-2 text-xs text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-900/20 p-2 rounded">
                    {form.businessType === "TRADING" && "Sales, Procurement, Inventory & Finance"}
                    {form.businessType === "MANUFACTURING" && "Manufacturing, BOM, Production, Inventory & Finance"}
                    {form.businessType === "BOTH" && "Trading + Manufacturing"}
                  </div>
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
                <p className="text-xs text-gray-500 dark:text-gray-400">Plan and billing terms can be changed later according to your subscription.</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className={`border-2 rounded-lg p-4 cursor-pointer ${form.plan === "V1_BASIC" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-200 dark:border-gray-700"}`} onClick={() => setForm({...form, plan: "V1_BASIC"})}>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-900 dark:text-white">Basic ERP</span><span className="text-brand-600 font-bold">Free Trial</span></div>
                    <p className="text-sm text-gray-500 mt-2">Core Trading & Finance.</p>
                  </div>
                  <div className={`border-2 rounded-lg p-4 cursor-pointer ${form.plan === "V1_MANUFACTURING" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-200 dark:border-gray-700"}`} onClick={() => setForm({...form, plan: "V1_MANUFACTURING"})}>
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
                  <div><span className="block text-xs text-gray-500 uppercase">Applicant</span><span className="font-medium">{form.fullName} - {form.username} ({form.email})</span></div>
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
}
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, X, Check, Shield, Info, Building, MapPin, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

type ProfileForm = {
  companyName: string;
  tradingName: string;
  legalName: string;
  email: string;
  mobile: string;
  gstin: string;
  panNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  website: string;
  description: string;
  contactPerson: string;
  alternatePhone: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
};

const EMPTY_FORM: ProfileForm = {
  companyName: '',
  tradingName: '',
  legalName: '',
  email: '',
  mobile: '',
  gstin: '',
  panNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  country: 'India',
  website: '',
  description: '',
  contactPerson: '',
  alternatePhone: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'en-IN',
};

function buildForm(u: any): ProfileForm {
  return {
    companyName:  u.companyName  || '',
    tradingName:  u.tradingName  || '',
    legalName:    u.legalName    || '',
    email:        u.email        || '',
    mobile:       u.mobile       || '',
    gstin:        u.gstin        || '',
    panNumber:    u.panNumber    || '',
    addressLine1: u.addressLine1 || '',
    addressLine2: u.addressLine2 || '',
    city:         u.city         || '',
    district:     u.district     || '',
    state:        u.state        || '',
    pincode:      u.pincode      || '',
    country:      u.country      || 'India',
    website:      u.website      || '',
    description:  u.description  || '',
    contactPerson:u.contactPerson|| '',
    alternatePhone:u.alternatePhone || '',
    currency:     u.currency     || 'INR',
    timezone:     u.timezone     || 'Asia/Kolkata',
    dateFormat:   u.dateFormat   || 'DD/MM/YYYY',
    numberFormat: u.numberFormat || 'en-IN',
  };
}

export default function CompanyProfilePage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['authMe'],
    queryFn: authApi.me,
    staleTime: 1000 * 60, // 1 min
  });

  useEffect(() => {
    if (data?.user) {
      setForm(buildForm(data.user));
    }
  }, [data?.user]);

  if (isLoading) return <div className="p-8 text-slate-500">Loading profile...</div>;
  if (!data?.user) return <div className="p-8 text-slate-500">Profile unavailable.</div>;

  const u = data.user;
  const snapshot = u.applicationSnapshot;

  const handleSave = async () => {
    try {
      setSaving(true);
      await authApi.updateProfile(form);
      toast.success('Company profile updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['authMe'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(buildForm(u));
    setEditing(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Company Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your operational tenant settings and view immutable registration records.
          </p>
        </div>
        
        {editing ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <X size={16} className="inline mr-2" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 shadow-sm disabled:opacity-50"
            >
              <Check size={16} className="inline mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/40"
          >
            <Pencil size={16} className="inline mr-2" /> Edit Profile
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION A: ORIGINAL APPLICATION (READ ONLY) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-100 dark:bg-slate-800">
              <Shield size={18} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Original Application</h2>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-lg flex gap-2 text-xs">
                <Info size={16} className="shrink-0" />
                <p>This information is preserved from your original INVENTRA application and cannot be changed.</p>
              </div>

              {snapshot ? (
                <div className="space-y-4">
                  <SnapshotField label="Application Reference" value={snapshot.applicationRef} />
                  <SnapshotField label="Original Applicant" value={snapshot.fullName} />
                  <SnapshotField label="Original Company Name" value={snapshot.companyName} />
                  <SnapshotField label="Username" value={snapshot.username} />
                  <SnapshotField label="Registration Email" value={snapshot.email} />
                  <SnapshotField label="Registration Mobile" value={snapshot.mobile} />
                  <SnapshotField label="Business Type" value={snapshot.businessType} />
                  <SnapshotField label="Industry" value={snapshot.industry} />
                  <SnapshotField label="Plan" value={snapshot.plan} />
                  <SnapshotField label="Submitted On" value={new Date(snapshot.submittedAt).toLocaleDateString()} />
                </div>
              ) : (
                <div className="text-slate-500 italic">No historical snapshot available.</div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION B: CURRENT COMPANY PROFILE */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Identity & Contact */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Building size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Company Identity & Contact</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field 
                label="Company Name" 
                value={form.companyName} 
                onChange={v => setForm({...form, companyName: v})}
                editing={editing}
                help="Preserved from application but can be updated here."
              />
              <Field 
                label="Legal Name" 
                value={form.legalName} 
                onChange={v => setForm({...form, legalName: v})}
                editing={editing}
              />
              <Field 
                label="Trading Name" 
                value={form.tradingName} 
                onChange={v => setForm({...form, tradingName: v})}
                editing={editing}
                help="Your current operational/trading name."
              />
              <Field 
                label="Website" 
                value={form.website} 
                onChange={v => setForm({...form, website: v})}
                editing={editing}
              />
              <Field 
                label="Operational Email" 
                value={form.email} 
                onChange={v => setForm({...form, email: v})}
                editing={editing}
              />
              <Field 
                label="Primary Phone" 
                value={form.mobile} 
                onChange={v => setForm({...form, mobile: v})}
                editing={editing}
              />
              <Field 
                label="Contact Person" 
                value={form.contactPerson} 
                onChange={v => setForm({...form, contactPerson: v})}
                editing={editing}
              />
            </div>
          </div>

          {/* Tax & Legal */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Address, Tax & Legal</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field 
                label="GSTIN" 
                value={form.gstin} 
                onChange={v => setForm({...form, gstin: v})}
                editing={editing}
                help="Used for GST and compliance documents."
              />
              <Field 
                label="PAN Number" 
                value={form.panNumber} 
                onChange={v => setForm({...form, panNumber: v})}
                editing={editing}
              />
              <Field 
                label="Address Line 1" 
                value={form.addressLine1} 
                onChange={v => setForm({...form, addressLine1: v})}
                editing={editing}
              />
              <Field 
                label="Address Line 2" 
                value={form.addressLine2} 
                onChange={v => setForm({...form, addressLine2: v})}
                editing={editing}
              />
              <Field 
                label="City" 
                value={form.city} 
                onChange={v => setForm({...form, city: v})}
                editing={editing}
              />
              <Field 
                label="State" 
                value={form.state} 
                onChange={v => setForm({...form, state: v})}
                editing={editing}
              />
              <Field 
                label="Pincode" 
                value={form.pincode} 
                onChange={v => setForm({...form, pincode: v})}
                editing={editing}
              />
              <Field 
                label="Country" 
                value={form.country} 
                onChange={v => setForm({...form, country: v})}
                editing={editing}
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Settings size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">ERP Configuration</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field 
                label="Currency" 
                value={form.currency} 
                onChange={v => setForm({...form, currency: v})}
                editing={editing}
              />
              <Field 
                label="Timezone" 
                value={form.timezone} 
                onChange={v => setForm({...form, timezone: v})}
                editing={editing}
              />
              <Field 
                label="Date Format" 
                value={form.dateFormat} 
                onChange={v => setForm({...form, dateFormat: v})}
                editing={editing}
              />
              <Field 
                label="Number Format" 
                value={form.numberFormat} 
                onChange={v => setForm({...form, numberFormat: v})}
                editing={editing}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SnapshotField({ label, value }: { label: string, value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || '-'}</span>
    </div>
  );
}

function Field({ label, value, onChange, editing, help }: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  editing: boolean;
  help?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {editing ? (
        <input 
          type="text" 
          value={value} 
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-shadow"
        />
      ) : (
        <div className="px-3 py-2 border border-transparent bg-slate-50 dark:bg-slate-800/50 rounded-md text-sm text-slate-800 dark:text-slate-200 font-medium">
          {value || <span className="text-slate-400 font-normal italic">Not set</span>}
        </div>
      )}
      {help && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{help}</p>}
    </div>
  );
}

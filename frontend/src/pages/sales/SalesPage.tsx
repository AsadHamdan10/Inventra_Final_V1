import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleApi, customerApi, materialApi, purchaseApi, bankApi } from '../../services/apiServices';
import { Confirm, Spinner, EmptyState, inr } from '../../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Save, Pencil, Trash2, Eye } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { saleToInvoiceData } from '../invoiceTemplates/invoiceTypes';
import { getSelectedTemplate, TemplateId } from '../invoiceTemplates/invoiceTemplateManager';
import { RowPrintButton } from '../invoiceTemplates/useInvoicePrint';
import PrintMenuButton from '../invoiceTemplates/PrintMenuButton';
import InvoiceTemplateGallery from '../invoiceTemplates/InvoiceTemplateGallery';

const GST_RATES = [0, 3, 5, 12, 18, 28];

interface SItem {
  materialName: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  itemTotal: number;
  avgPurchaseCost: number;
  itemProfit: number;
}

const emptyItem = (): SItem => ({
  materialName: '', hsnCode: '', quantity: 0, unitPrice: 0,
  purchasePrice: 0, gstPercent: 18, taxableAmount: 0,
  gstAmount: 0, itemTotal: 0, avgPurchaseCost: 0, itemProfit: 0,
});

const emptyForm = () => ({
  invoiceNo: '', invoiceDate: format(new Date(), 'yyyy-MM-dd'),
  customerId: '' as string | number, companyName: '', companyGstin: '',
  paymentTerms: 30, poNo: '', otherExpense: 0, roundOff: 0,
  paymentReceived: 0,
  totalTaxable: 0, totalGst: 0, grandTotal: 0,
  totalPurchaseCost: 0, grossProfit: 0, profitPct: 0,
  igstAmount: 0, cgstAmount: 0, sgstAmount: 0,
  notes: '',
customerAddress: '',
deliveryAddress: '',
isInterState: false,
items: [emptyItem(), emptyItem()],

  // ── Professional GST Invoice Template — additive-only, all optional ──
  referenceNo: '', referenceDate: '',
  deliveryNote: '',
  buyerOrderNo: '', buyerOrderDate: '',
  dispatchDocNo: '', deliveryNoteDate: '',
  modeOfPayment: '', otherReference: '',
  transportName: '', lrNumber: '', destination: '', vehicleNumber: '',
  ewayBillNo: '', termsOfDelivery: '',

  // Ship To (Consignee) — per-invoice only, defaults to "same as buyer"
  useBuyerAsShipping: true,
  shipCompanyName: '', shipAddressLine1: '', shipAddressLine2: '',
  shipCity: '', shipState: '', shipPincode: '', shipGSTIN: '',
  shipContactPerson: '', shipMobile: '',
});

function calcItem(it: SItem): SItem {
  const t = +(it.quantity * it.unitPrice).toFixed(2);
  const g = +(t * it.gstPercent / 100).toFixed(2);
  const cost = +(it.quantity * it.purchasePrice).toFixed(2);
  return { ...it, taxableAmount: t, gstAmount: g, itemTotal: +(t + g).toFixed(2), avgPurchaseCost: cost, itemProfit: +(t - cost).toFixed(2) };
}

function calcTotals(items: SItem[], oe: number, ro: number, inter: boolean) {
  const active = items.filter(i => i.materialName && i.quantity > 0);
  const tt = +active.reduce((s, i) => s + i.taxableAmount, 0).toFixed(2);
  const tg = +active.reduce((s, i) => s + i.gstAmount, 0).toFixed(2);
  const tpc = +active.reduce((s, i) => s + i.avgPurchaseCost, 0).toFixed(2);
  const gp = +(tt - tpc - oe).toFixed(2);
  const gt = +(tt + tg + ro).toFixed(2);
  return {
    totalTaxable: tt, totalGst: tg,
    igstAmount: inter ? tg : 0,
    cgstAmount: inter ? 0 : +(tg / 2).toFixed(2),
    sgstAmount: inter ? 0 : +(tg / 2).toFixed(2),
    grandTotal: gt, totalPurchaseCost: tpc, grossProfit: gp,
    profitPct: tt > 0 ? +(((tt - tpc - oe) / tt) * 100).toFixed(2) : 0,
  };
}

export default function SalesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const company = {
    companyName: user?.companyName ?? '',
    gstin: user?.gstin,
    addressLine1: user?.addressLine1,
    addressLine2: user?.addressLine2,
    city: user?.city,
    state: user?.state,
    pincode: user?.pincode,
    mobile: user?.mobile,
    email: user?.email,
  };

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [active, setActive] = useState({ from: '', to: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [del, setDel] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showGstDetails, setShowGstDetails] = useState(false); // Additional Invoice Details — collapsed by default

  // Gallery state — shared across all rows
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>(() => getSelectedTemplate('sales'));

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', active.from, active.to],
    queryFn: () => saleApi.list(active.from && active.to ? { from: active.from, to: active.to } : {}),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => customerApi.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => materialApi.list() });
  const { data: bankAccounts = [] } = useQuery({
  queryKey: ['bank-accounts'],
  queryFn: () => bankApi.accounts(),
});

const firstBankAccount = bankAccounts[0];

  const recalc = (f: typeof form) => {
    const items = f.items.map(calcItem);
    return { ...f, items, ...calcTotals(items, f.otherExpense, f.roundOff, f.isInterState) };
  };

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const v = target.type === 'checkbox' ? target.checked : target.type === 'number' ? +target.value : target.value;
    setForm(p => recalc({ ...p, [k]: v }));
  };

  const sif = (idx: number, k: keyof SItem) => async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = ['quantity', 'unitPrice', 'purchasePrice', 'gstPercent'].includes(k) ? +e.target.value : e.target.value;
    if (k === 'materialName') {
      const mat = (materials as Array<{ materialName: string; hsnCode?: string }>).find((m) => m.materialName === v);
      let pp = 0;
      const hsn = mat?.hsnCode || '';
      try { const lp = await purchaseApi.getLastPrice(v as string); pp = (lp as { purchasePrice?: number }).purchasePrice || 0; } catch { /* ignored */ }
      setForm(p => {
        const items = p.items.map((it, i) => i === idx ? { ...it, materialName: v as string, hsnCode: hsn, purchasePrice: pp } : it);
        return recalc({ ...p, items });
      });
    } else {
      setForm(p => {
        const items = p.items.map((it, i) => i === idx ? { ...it, [k]: v } : it);
        return recalc({ ...p, items });
      });
    }
  };

  const selCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const c = (customers as Array<{
      
  id: number;
  companyName: string;
  gstin?: string;
  paymentTerms?: number;
  address?: string;
  deliveryAddress?: string;
}>).find((cu) => cu.id === +e.target.value);
    setForm(p =>
  recalc({
    ...p,
    customerId: c?.id || '',
    companyName: c?.companyName || '',
    companyGstin: c?.gstin || '',
    paymentTerms: c?.paymentTerms || 30,

    customerAddress: c?.address || '',
    deliveryAddress: c?.deliveryAddress || '',
  })
);
  };

  const addRow = () => setForm(p => ({ ...p, items: [...p.items, emptyItem()] }));
  const removeRow = (idx: number) => setForm(p => recalc({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const openNew = () => { setForm(emptyForm()); setEditing(null); setModalOpen(true); };
  const openEdit = (s: Record<string, unknown>) => {
    setForm({
      invoiceNo: s.invoiceNo as string,
      invoiceDate: format(new Date(s.invoiceDate as string), 'yyyy-MM-dd'),
      customerId: (s.customerId as string) || '',
      companyName: s.companyName as string,
      companyGstin: (s.companyGstin as string) || '',
      paymentTerms: s.paymentTerms as number,
      poNo: (s.poNo as string) || '',
      otherExpense: +(s.otherExpense as number),
      roundOff: +(s.roundOff as number),
      paymentReceived: +(s.paymentReceived as number),
      totalTaxable: +(s.totalTaxable as number),
      totalGst: +(s.totalGst as number),
      grandTotal: +(s.grandTotal as number),
      totalPurchaseCost: +(s.totalPurchaseCost as number),
      grossProfit: +(s.grossProfit as number),
      profitPct: +(s.profitPct as number),
      igstAmount: +((s.igstAmount as number) || 0),
      cgstAmount: +((s.cgstAmount as number) || 0),
      sgstAmount: +((s.sgstAmount as number) || 0),
      notes: (s.notes as string) || '',
customerAddress: (s.customerAddress as string) || '',
deliveryAddress: (s.deliveryAddress as string) || '',
isInterState: +((s.igstAmount as number) || 0) > 0,

      // ── Professional GST Invoice Template — additive-only ──
      referenceNo: (s.referenceNo as string) || '',
      referenceDate: s.referenceDate ? format(new Date(s.referenceDate as string), 'yyyy-MM-dd') : '',
      deliveryNote: (s.deliveryNote as string) || '',
      buyerOrderNo: (s.buyerOrderNo as string) || '',
      buyerOrderDate: s.buyerOrderDate ? format(new Date(s.buyerOrderDate as string), 'yyyy-MM-dd') : '',
      dispatchDocNo: (s.dispatchDocNo as string) || '',
      deliveryNoteDate: s.deliveryNoteDate ? format(new Date(s.deliveryNoteDate as string), 'yyyy-MM-dd') : '',
      modeOfPayment: (s.modeOfPayment as string) || '',
      otherReference: (s.otherReference as string) || '',
      transportName: (s.transportName as string) || '',
      lrNumber: (s.lrNumber as string) || '',
      destination: (s.destination as string) || '',
      vehicleNumber: (s.vehicleNumber as string) || '',
      ewayBillNo: (s.ewayBillNo as string) || '',
      termsOfDelivery: (s.termsOfDelivery as string) || '',

      useBuyerAsShipping: (s.useBuyerAsShipping as boolean) ?? true,
      shipCompanyName: (s.shipCompanyName as string) || '',
      shipAddressLine1: (s.shipAddressLine1 as string) || '',
      shipAddressLine2: (s.shipAddressLine2 as string) || '',
      shipCity: (s.shipCity as string) || '',
      shipState: (s.shipState as string) || '',
      shipPincode: (s.shipPincode as string) || '',
      shipGSTIN: (s.shipGSTIN as string) || '',
      shipContactPerson: (s.shipContactPerson as string) || '',
      shipMobile: (s.shipMobile as string) || '',
      items: (s.items as SItem[])?.length
        ? (s.items as Array<Record<string, unknown>>).map((it) => ({
            materialName: it.materialName as string,
            hsnCode: (it.hsnCode as string) || '',
            quantity: +(it.quantity as number),
            unitPrice: +(it.unitPrice as number),
            purchasePrice: +(it.purchasePrice as number),
            gstPercent: +(it.gstPercent as number),
            taxableAmount: +(it.taxableAmount as number),
            gstAmount: +(it.gstAmount as number),
            itemTotal: +(it.itemTotal as number),
            avgPurchaseCost: +(it.avgPurchaseCost as number),
            itemProfit: +(it.itemProfit as number),
          }))
        : [emptyItem()],
    });
    setEditing(s.id as number);
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const activeItems = form.items.filter(i => i.materialName && i.quantity > 0);
      if (!activeItems.length) throw new Error('Add at least one item.');
      if (!form.companyName) throw new Error('Customer is required.');
      const { paymentReceived, ...saleData } = form;
      void paymentReceived;
      const payload = { ...saleData, customerId: saleData.customerId ? +saleData.customerId : null, items: activeItems };
      return editing ? saleApi.update(editing, payload) : saleApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); setModalOpen(false); toast.success('Invoice saved.'); },
    onError: (e: { message?: string; response?: { data?: { error?: string } } }) =>
      toast.error(e.message || e.response?.data?.error || 'Save failed.'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => saleApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); setDel(null); toast.success('Deleted.'); },
  });

  const totGrand = (sales as Array<{ grandTotal: number }>).reduce((s, sale) => s + +sale.grandTotal, 0);
  const totReceived = (sales as Array<{ paymentReceived: number }>).reduce((s, sale) => s + +sale.paymentReceived, 0);

  const quickFilter = (preset: 'month' | 'year' | 'all') => {
    if (preset === 'all') { setFrom(''); setTo(''); setActive({ from: '', to: '' }); return; }
    const now = new Date();
    if (preset === 'month') {
      const f = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
      const t = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
      setFrom(f); setTo(t); setActive({ from: f, to: t });
    }
    if (preset === 'year') {
      const f = `${now.getFullYear()}-01-01`;
      const t = `${now.getFullYear()}-12-31`;
      setFrom(f); setTo(t); setActive({ from: f, to: t });
    }
  };

  // Modal print button — uses viewModal data
  const viewInvoiceData = viewModal
  ? saleToInvoiceData(viewModal, company, firstBankAccount)
  : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Desktop Dashboard Header ── */}
      <div className="hidden lg:block">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sales Management</h1>
              <p className="mt-2 text-gray-500 text-base">Manage customer invoices and track receivables</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Today</p>
              <p className="font-semibold text-slate-700">{format(new Date(), 'dd MMM yyyy')}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-5 mt-8">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-500">Total Sales</p>
              <h3 className="text-2xl font-bold text-blue-700 mt-2">{inr(totGrand)}</h3>
            </div>
            <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm text-gray-500">Received</p>
              <h3 className="text-2xl font-bold text-green-600 mt-2">{inr(totReceived)}</h3>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <h3 className="text-2xl font-bold text-red-600 mt-2">{inr(totGrand - totReceived)}</h3>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <p className="text-sm text-gray-500">Customers</p>
              <h3 className="text-2xl font-bold text-violet-600 mt-2">{(customers as unknown[]).length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 space-y-4">

        {/* ── Mobile Heading ── */}
        <div className="lg:hidden mb-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Sales</h1>
          <p className="text-gray-500 mt-1">Manage customer invoices and receivables</p>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm max-w-full">
          <div className="hidden lg:flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" className="input w-40" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" className="input w-40" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn-primary h-10" onClick={() => setActive({ from, to })}>Filter</button>
            <button className="btn-secondary h-10" onClick={() => quickFilter('all')}>All Records</button>
            <button className="btn-secondary h-10" onClick={() => quickFilter('month')}>This Month</button>
            <button className="btn-secondary h-10" onClick={() => quickFilter('year')}>This Year</button>
            <button
              className="h-10 px-4 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-medium transition-colors"
              onClick={() => navigate(`/sales-register-print?from=${active.from}&to=${active.to}`)}
            >
              Preview Sales Report
            </button>
          </div>
          <div className="lg:hidden space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" className="input w-full text-sm" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" className="input w-full text-sm" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn-primary h-11 w-full" onClick={() => setActive({ from, to })}>Filter</button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary h-10" onClick={() => quickFilter('all')}>All Records</button>
              <button className="btn-secondary h-10" onClick={() => quickFilter('month')}>This Month</button>
              <button className="btn-secondary h-10" onClick={() => quickFilter('year')}>This Year</button>
              <button
                className="h-16 px-4 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-medium transition-colors"
                onClick={() => navigate(`/sales-register-print?from=${active.from}&to=${active.to}`)}
              >
                Preview Report
              </button>
            </div>
          </div>
        </div>

        {/* ── Table / Cards ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-visible">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={openNew}
                className="hidden lg:flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus size={16} />
                New Invoice
              </button>
            </div>
            <div className="lg:hidden mb-4 space-y-3">
              <button
                onClick={openNew}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-md"
              >
                + New Invoice
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Invoices</h2>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-green-600 uppercase font-medium">Received</p>
                <p className="text-xl font-bold text-green-700 mt-1">{inr(totReceived)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-red-600 uppercase font-medium">Outstanding</p>
                <p className="text-xl font-bold text-red-700 mt-1">{inr(totGrand - totReceived)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-blue-600 uppercase font-medium">Total Sales</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{inr(totGrand)}</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (sales as unknown[]).length === 0 ? (
            <EmptyState message="No invoices found. Click '+ New Invoice' to create one." />
          ) : (
            <>
              {/* ── Desktop Table ── */}
              <div
  className="hidden lg:block overflow-x-auto"
  style={{ overflowY: 'visible' }}
>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 dark:bg-gray-700 text-white">
                      <th className="px-3 py-3 text-left text-xs font-semibold w-8">#</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold">INVOICE NO</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold">DATE</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold">CUSTOMER</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold">ITEMS</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold">TAXABLE</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold">GST</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold">TOTAL</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold">RECEIVED</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold">BAL</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sales as Array<Record<string, unknown>>).map((s, idx) => {
                      const bal = +(s.grandTotal as number) - +(s.paymentReceived as number);
                      const rowInvoiceData = saleToInvoiceData(s, company, firstBankAccount);
                      return (
                        <tr key={s.id as number} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-3 font-bold text-gray-800 dark:text-gray-200 whitespace">{s.invoiceNo as string}</td>
                          <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{format(new Date(s.invoiceDate as string), 'dd/MM/yyyy')}</td>
                          <td className="px-3 py-3 max-w-[180px]">
                            <div className="font-medium text-gray-800 dark:text-gray-200">{s.companyName as string}</div>
                            {typeof s.companyGstin === 'string' && (<div className="text-xs text-gray-400 truncate">{s.companyGstin}</div>)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{(s.items as unknown[])?.length || 0}</span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{inr(s.totalTaxable as number)}</td>
                          <td className="px-3 py-3 text-right font-semibold text-green-600">{inr(s.totalGst as number)}</td>
                          <td className="px-3 py-3 text-right font-bold text-gray-800 dark:text-gray-200">{inr(s.grandTotal as number)}</td>
                          <td className="px-3 py-3 text-right text-green-600 font-medium">{inr(s.paymentReceived as number)}</td>
                          <td className="px-3 py-3 text-right">
                            <span className={`font-semibold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>{inr(bal)}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {/* Print ▼ first */}
                              <RowPrintButton
                                invoiceType="sales"
                                invoiceData={rowInvoiceData}
                                invoiceNo={s.invoiceNo as string}
                                templateId={activeTemplateId}
                                onChangeDesign={() => setGalleryOpen(true)}
                              />
                              <button
                                onClick={() => setViewModal(s)}
                                className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => openEdit(s)}
                                className="w-7 h-7 flex items-center justify-center bg-amber-100 text-amber-600 rounded hover:bg-amber-200 transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDel(s.id as number)}
                                className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Cards ── */}
              <div className="lg:hidden p-4 space-y-4">
                {(sales as Array<Record<string, unknown>>).map((s) => {
                  const bal = +(s.grandTotal as number) - +(s.paymentReceived as number);
                  const rowInvoiceData = saleToInvoiceData(s, company, firstBankAccount);
                  return (
                    <div key={s.id as number} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
                      {/* Card Header */}
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{s.invoiceNo as string}</h3>
                            <p className="text-indigo-600 font-bold mt-1">{inr(s.grandTotal as number)}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bal > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {bal > 0 ? 'Due' : 'Paid'}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Customer</p>
                          <p className="font-medium">{s.companyName as string}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <p className="text-xs text-gray-500">Date</p>
                            <p>{format(new Date(s.invoiceDate as string), 'dd/MM/yyyy')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Items</p>
                            <p>{(s.items as unknown[])?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Received</p>
                            <p className="text-green-600 font-semibold">{inr(s.paymentReceived as number)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Balance</p>
                            <p className={bal > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{inr(bal)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions — Print full width, then View/Edit/Delete */}
                      <div className="px-4 pb-3 pt-1 border-t">
                        <PrintMenuButton
                          invoiceData={rowInvoiceData}
                          invoiceType="sales"
                          invoiceNo={s.invoiceNo as string}
                          templateId={activeTemplateId}
                          onChangeDesign={() => setGalleryOpen(true)}
                          variant="mobile"
                        />
                        <div className="grid grid-cols-3 mt-2 border rounded-xl overflow-hidden">
                          <button onClick={() => setViewModal(s)} className="py-3 text-blue-600 border-r text-sm font-medium">View</button>
                          <button onClick={() => openEdit(s)} className="py-3 text-orange-600 border-r text-sm font-medium">Edit</button>
                          <button onClick={() => setDel(s.id as number)} className="py-3 text-red-600 text-sm font-medium">Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add / Edit Invoice Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold">{editing ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">INVOICE NO</label>
                  <input className="input font-mono" value={form.invoiceNo} onChange={sf('invoiceNo')} placeholder="Auto-generated if blank" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">INVOICE DATE <span className="text-red-500">*</span></label>
                  <input className="input" type="date" value={form.invoiceDate} onChange={sf('invoiceDate')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CUSTOMER <span className="text-red-500">*</span></label>
                  <select className="input" value={form.customerId} onChange={selCustomer}>
                    <option value="">— Select Customer —</option>
                    {(customers as Array<{ id: number; companyName: string }>).map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">COMPANY GSTIN</label>
                  <input className="input font-mono uppercase bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" value={form.companyGstin} onChange={sf('companyGstin')} placeholder="GSTIN" />
                </div>
                <div className="lg:col-span-2">
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
    DELIVERY AT
  </label>

  <textarea
    className="input"
    rows={2}
    value={form.deliveryAddress}
    onChange={sf('deliveryAddress')}
    placeholder="Delivery Address"
  />
</div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">PO NO</label>
                  <input className="input" value={form.poNo} onChange={sf('poNo')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">PAYMENT TERMS (DAYS)</label>
                  <input className="input" type="number" min="0" value={form.paymentTerms} onChange={sf('paymentTerms')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-500 uppercase tracking-wide mb-1.5">OTHER EXPENSE (₹)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.otherExpense} onChange={sf('otherExpense')} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ROUND OFF (₹)</label>
                  <input className="input" type="number" step="0.01" value={form.roundOff} onChange={sf('roundOff')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">PAYMENT RECEIVED (₹)</label>
                  <input className="input bg-gray-100 dark:bg-gray-800 cursor-not-allowed text-gray-500" value={inr(form.paymentReceived)} readOnly />
                  <p className="text-xs text-gray-400 mt-1">Automatically managed from Receivables.</p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 col-span-1 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" checked={form.isInterState} onChange={sf('isInterState')} className="w-4 h-4" />
                    <span className="text-blue-700 dark:text-blue-300">Inter-State Sale (IGST)</span>
                  </label>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Items *</span>
                  <button className="btn-secondary btn-sm" onClick={addRow}><Plus size={13} />Add Row</button>
                </div>
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800 dark:bg-gray-700 text-white">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-8">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold min-w-[160px]">MATERIAL *</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-20">HSN</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-24">QTY</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold min-w-[110px]">SALE RATE (₹)</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold w-28 bg-green-700">
                          <div>PURCHASE PRICE (₹)</div>
                          <div className="font-normal text-[10px] opacity-80">FOR PROFIT CALC</div>
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-20">GST %</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-24">TAXABLE</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-24">GST AMT</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-24">ITEM TOTAL</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-28 bg-green-700">ITEM PROFIT</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
                        <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <select className="input text-xs py-1 px-2" value={it.materialName} onChange={sif(idx, 'materialName')}>
                              <option value="">— Select —</option>
                              {(materials as Array<{ id: number; materialName: string }>).map((m) => <option key={m.id} value={m.materialName}>{m.materialName}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5"><input className="input text-xs py-1 px-2 font-mono" value={it.hsnCode} onChange={sif(idx, 'hsnCode')} /></td>
                          <td className="px-2 py-1.5"><input className="input w-full text-[13px] py-1 px-2 text-center" type="number" min="0" step="0.001" value={it.quantity || ''} onChange={sif(idx, 'quantity')} placeholder="0" /></td>
                          <td className="px-2 py-1.5"><input className="input w-full text-[13px] py-1 px-2 text-right" type="number" min="0" step="0.01" value={it.unitPrice || ''} onChange={sif(idx, 'unitPrice')} placeholder="0.00" /></td>
                          <td className="px-2 py-1.5"><input className="input text-xs py-1 px-2 text-right bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" type="number" min="0" step="0.01" value={it.purchasePrice || ''} onChange={sif(idx, 'purchasePrice')} placeholder="0.00" /></td>
                          <td className="px-2 py-1.5">
                            <select className="input text-xs py-1 px-2" value={it.gstPercent} onChange={sif(idx, 'gstPercent')}>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium">{it.taxableAmount?.toFixed(2) || '0.00'}</td>
                          <td className="px-3 py-2 text-right text-sm text-green-600">{it.gstAmount?.toFixed(2) || '0.00'}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold">{it.itemTotal?.toFixed(2) || '0.00'}</td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-green-600 bg-green-50 dark:bg-green-900/10">{it.itemProfit?.toFixed(2) || '0.00'}</td>
                          <td className="px-2 py-1.5">
                            {form.items.length > 1 && (
                              <button onClick={() => removeRow(idx)} className="w-6 h-6 flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500 rounded hover:bg-red-200"><X size={12} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-5">
                  {form.items.map((it, idx) => (
                    <div key={idx} className="border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 bg-white dark:bg-gray-800 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg">Item #{idx + 1}</span>
                        {form.items.length > 1 && (
                          <button onClick={() => removeRow(idx)} className="px-3 py-1 text-xs font-semibold text-red-600 border border-red-300 rounded-lg">Remove</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <select className="input w-full" value={it.materialName} onChange={sif(idx, 'materialName')}>
                          <option value="">Select Material</option>
                          {(materials as Array<{ id: number; materialName: string }>).map((m) => <option key={m.id} value={m.materialName}>{m.materialName}</option>)}
                        </select>
                        <input className="input w-full" placeholder="HSN Code" value={it.hsnCode} onChange={sif(idx, 'hsnCode')} />
                        <input className="input w-full" type="number" placeholder="Quantity" value={it.quantity || ''} onChange={sif(idx, 'quantity')} />
                        <input className="input w-full" type="number" placeholder="Sale Rate" value={it.unitPrice || ''} onChange={sif(idx, 'unitPrice')} />
                        <input className="input w-full bg-green-50 dark:bg-green-900/10 border-green-200" type="number" placeholder="Purchase Price (for profit)" value={it.purchasePrice || ''} onChange={sif(idx, 'purchasePrice')} />
                        <select className="input w-full" value={it.gstPercent} onChange={sif(idx, 'gstPercent')}>
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Taxable</p>
                            <p className="font-semibold">₹{it.taxableAmount.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-blue-600">GST</p>
                            <p className="font-semibold text-blue-600">₹{it.gstAmount.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-green-600">Total</p>
                            <p className="font-bold text-green-600">₹{it.itemTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addRow} className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:border-brand-400 hover:text-brand-600 rounded-xl text-sm font-medium transition-colors">
                  + Add Item
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex flex-wrap gap-6 items-center border border-gray-200 dark:border-gray-700">
                {([
                  ['TAXABLE', form.totalTaxable, 'text-gray-700 dark:text-gray-300'],
                  ['GST', form.totalGst, 'text-green-600'],
                  ['PURCHASE COST', form.totalPurchaseCost, 'text-red-500'],
                  ['GROSS PROFIT', form.grossProfit, 'text-green-600'],
                  ['GRAND TOTAL', form.grandTotal, 'text-gray-900 dark:text-white font-bold text-xl'],
                ] as [string, number, string][]).map(([label, val, cls]) => (
                  <div key={label}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                    <p className={`font-semibold ${cls}`}>₹{(+(val)).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* ── Additional Invoice Details (collapsible, default collapsed) ── */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGstDetails((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  <span>Additional Invoice Details</span>
                  <span className="text-xs text-gray-400">{showGstDetails ? '▲ Hide' : '▼ Show (optional)'}</span>
                </button>
                {showGstDetails && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">REFERENCE NUMBER</label>
                        <input className="input" value={form.referenceNo} onChange={sf('referenceNo')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">REFERENCE DATE</label>
                        <input className="input" type="date" value={form.referenceDate} onChange={sf('referenceDate')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">DELIVERY NOTE</label>
                        <input className="input" value={form.deliveryNote} onChange={sf('deliveryNote')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">MODE OF PAYMENT</label>
                        <input className="input" value={form.modeOfPayment} onChange={sf('modeOfPayment')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">BUYER'S ORDER NUMBER</label>
                        <input className="input" value={form.buyerOrderNo} onChange={sf('buyerOrderNo')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">BUYER'S ORDER DATE</label>
                        <input className="input" type="date" value={form.buyerOrderDate} onChange={sf('buyerOrderDate')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">DISPATCH DOCUMENT NUMBER</label>
                        <input className="input" value={form.dispatchDocNo} onChange={sf('dispatchDocNo')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">DELIVERY NOTE DATE</label>
                        <input className="input" type="date" value={form.deliveryNoteDate} onChange={sf('deliveryNoteDate')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">OTHER REFERENCE</label>
                        <input className="input" value={form.otherReference} onChange={sf('otherReference')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">TRANSPORT NAME</label>
                        <input className="input" value={form.transportName} onChange={sf('transportName')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">LR / RR NUMBER</label>
                        <input className="input" value={form.lrNumber} onChange={sf('lrNumber')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">DESTINATION</label>
                        <input className="input" value={form.destination} onChange={sf('destination')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">VEHICLE NUMBER</label>
                        <input className="input" value={form.vehicleNumber} onChange={sf('vehicleNumber')} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-WAY BILL NUMBER</label>
                        <input className="input" value={form.ewayBillNo} onChange={sf('ewayBillNo')} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">TERMS OF DELIVERY</label>
                        <input className="input" value={form.termsOfDelivery} onChange={sf('termsOfDelivery')} />
                      </div>
                    </div>

                    {/* ── Ship To (Consignee) ── */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer mb-3">
                        <input type="checkbox" className="w-4 h-4" checked={form.useBuyerAsShipping} onChange={sf('useBuyerAsShipping')} />
                        <span>Use Buyer Address for Shipping</span>
                      </label>
                      {!form.useBuyerAsShipping && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SHIP TO — COMPANY NAME</label>
                            <input className="input" value={form.shipCompanyName} onChange={sf('shipCompanyName')} />
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ADDRESS LINE 1</label>
                            <input className="input" value={form.shipAddressLine1} onChange={sf('shipAddressLine1')} />
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ADDRESS LINE 2</label>
                            <input className="input" value={form.shipAddressLine2} onChange={sf('shipAddressLine2')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CITY</label>
                            <input className="input" value={form.shipCity} onChange={sf('shipCity')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">STATE</label>
                            <input className="input" value={form.shipState} onChange={sf('shipState')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">PINCODE</label>
                            <input className="input" value={form.shipPincode} onChange={sf('shipPincode')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GSTIN</label>
                            <input className="input font-mono uppercase" value={form.shipGSTIN} onChange={sf('shipGSTIN')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CONTACT PERSON</label>
                            <input className="input" value={form.shipContactPerson} onChange={sf('shipContactPerson')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">MOBILE</label>
                            <input className="input" value={form.shipMobile} onChange={sf('shipMobile')} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">NOTES</label>
                <textarea className="input" rows={2} value={form.notes} onChange={sf('notes')} placeholder="Optional notes…" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
              <button className="btn-secondary px-6" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary px-6 py-2.5" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save size={15} />
                {save.isPending ? 'Saving…' : editing ? 'Update Invoice' : 'Save Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Invoice Modal ── */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setViewModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-bold">Invoice: {viewModal.invoiceNo as string}</h2>
              <div className="flex items-center gap-3">
                {viewInvoiceData && (
                  <PrintMenuButton
                    invoiceData={viewInvoiceData}
                    invoiceType="sales"
                    invoiceNo={viewModal.invoiceNo as string}
                    templateId={activeTemplateId}
                    onChangeDesign={() => setGalleryOpen(true)}
                    variant="full"
                  />
                )}
                <button onClick={() => setViewModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Customer:</span> <strong>{viewModal.companyName as string}</strong></div>
                <div><span className="text-gray-400">Date:</span> <strong>{format(new Date(viewModal.invoiceDate as string), 'dd MMM yyyy')}</strong></div>
                <div><span className="text-gray-400">GSTIN:</span> <span className="font-mono text-xs">{(viewModal.companyGstin as string) || '—'}</span></div>
                <div>
                  <span className="text-gray-400">Received:</span>{' '}
                  <strong className={+(viewModal.grandTotal as number) > +(viewModal.paymentReceived as number) ? 'text-red-500' : 'text-green-600'}>
                    {inr(viewModal.paymentReceived as number)} / {inr(viewModal.grandTotal as number)}
                  </strong>
                </div>
                {viewModal.poNo ? (<div><span className="text-gray-400">PO No:</span><strong>{String(viewModal.poNo)}</strong></div>) : null}
              </div>
              <div className="space-y-3">
                {(viewModal.items as Array<Record<string, unknown>>)?.map((it, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{it.materialName as string}</h4>
                    <div className="grid grid-cols-2 gap-y-2 mt-3 text-sm">
                      <span className="text-gray-500">Qty</span><span className="font-medium text-right">{it.quantity as number}</span>
                      <span className="text-gray-500">Sale Rate</span><span className="font-medium text-right">{inr(it.unitPrice as number)}</span>
                      <span className="text-gray-500">GST</span><span className="font-medium text-right">{it.gstPercent as number}%</span>
                      <span className="text-gray-500">Item Total</span><span className="font-bold text-right">{inr(it.itemTotal as number)}</span>
                    </div>
                  </div>
                ))}
                <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Taxable</span><span>{inr(viewModal.totalTaxable as number)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">GST</span><span className="text-green-600">{inr(viewModal.totalGst as number)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-semibold">Grand Total</span>
                    <span className="text-xl font-bold text-brand-600">{inr(viewModal.grandTotal as number)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Received</span>
                    <span className="text-green-600 font-medium">{inr(viewModal.paymentReceived as number)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Balance</span>
                    <span className={`font-bold ${+(viewModal.grandTotal as number) - +(viewModal.paymentReceived as number) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {inr(+(viewModal.grandTotal as number) - +(viewModal.paymentReceived as number))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Gallery (shared across all rows) ── */}
      {galleryOpen && (
        <InvoiceTemplateGallery
          type="sales"
          onClose={() => setGalleryOpen(false)}
          onSelect={(id) => { setActiveTemplateId(id); }}
        />
      )}

      <Confirm
        open={del !== null}
        onConfirm={() => remove.mutate(del!)}
        onCancel={() => setDel(null)}
        title="Delete Invoice"
        message="Delete this sales invoice? This cannot be undone."
        danger
      />
    </div>
  );
}

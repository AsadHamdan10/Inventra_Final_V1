import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, FileText } from 'lucide-react';
import { purchaseQuotationApi } from '../../services/apiServices';
import { PageHeader, Modal, Field, Spinner, SearchInput, EmptyState } from '../../components/ui';
import toast from 'react-hot-toast';

const emptyForm = {
  vendorId: '',
  requisitionId: '',
  quotedPrice: 0,
  validUntil: ''
};

export default function PurchaseQuotationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ['procurement-quotations'],
    queryFn: () => purchaseQuotationApi.list()
  });

  const create = useMutation({
    mutationFn: () => purchaseQuotationApi.create({ ...form, quotedPrice: Number(form.quotedPrice) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-quotations'] });
      setOpen(false);
      toast.success('Quotation created.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating quotation')
  });

  const approve = useMutation({
    mutationFn: (id: number) => purchaseQuotationApi.updateStatus(id, 'APPROVED'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-quotations'] });
      toast.success('Approved.');
    }
  });

  const filtered = (data || []).filter((r: any) => 
    r.vendorId?.toString().includes(search) ||
    r.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (k: keyof typeof emptyForm) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Purchase Quotations"
          subtitle={`${data.length} records`}
          actions={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search Quotations..."
            />
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Quotations</h1>
          <p className="text-gray-500 mt-1">{`${data.length} records`}</p>
        </div>
        <div className="w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="input w-full"
          />
        </div>
      </div>

      <div className="lg:hidden mb-4">
        <button className="btn-primary w-full justify-center" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus size={15} /> Add Quotation
        </button>
      </div>

      <div className="hidden lg:flex justify-end -mt-14 mb-4">
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus size={15} /> Add Quotation
        </button>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Vendor ID</th>
                    <th>Req ID</th>
                    <th>Quoted Price</th>
                    <th>Status</th>
                    <th>Valid Until</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-medium">PQ-{r.id}</td>
                      <td>{r.vendorId}</td>
                      <td>{r.requisitionId}</td>
                      <td>₹{r.quotedPrice}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {r.status || 'PENDING'}
                        </span>
                      </td>
                      <td>{r.validUntil}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-ghost btn-sm text-blue-600" title="View"><FileText size={15} /></button>
                          {r.status !== 'APPROVED' && (
                            <button className="btn-ghost btn-sm text-green-600" title="Approve" onClick={() => approve.mutate(r.id)}>
                              <CheckCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-3">
              {filtered.map((r: any) => (
                <div key={r.id} className="card overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <div className="font-semibold text-base">PQ-{r.id}</div>
                    <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.status || 'PENDING'}
                    </span>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div><span className="text-gray-500">Vendor ID:</span> {r.vendorId}</div>
                    <div><span className="text-gray-500">Price:</span> ₹{r.quotedPrice}</div>
                    <div><span className="text-gray-500">Valid Until:</span> {r.validUntil}</div>
                  </div>
                  <div className="grid grid-cols-2 border-t">
                    <button className="flex items-center justify-center gap-2 py-3 text-blue-600 border-r">
                      <FileText size={16} /> View
                    </button>
                    {r.status !== 'APPROVED' ? (
                      <button className="flex items-center justify-center gap-2 py-3 text-green-600" onClick={() => approve.mutate(r.id)}>
                        <CheckCircle size={16} /> Approve
                      </button>
                    ) : (
                       <div className="flex items-center justify-center gap-2 py-3 text-gray-400">Approved</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Quotation">
        <div className="space-y-3">
          <Field label="Vendor ID" required>
            <input className="input" value={form.vendorId} onChange={handleChange('vendorId')} />
          </Field>
          <Field label="Requisition ID">
            <input className="input" value={form.requisitionId} onChange={handleChange('requisitionId')} />
          </Field>
          <Field label="Quoted Price" required>
            <input className="input" type="number" step="0.01" value={form.quotedPrice} onChange={handleChange('quotedPrice')} />
          </Field>
          <Field label="Valid Until">
            <input className="input" type="date" value={form.validUntil} onChange={handleChange('validUntil')} />
          </Field>
          <div className="flex gap-2 justify-end pt-2">
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}



import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, FileText } from 'lucide-react';
import { purchaseRequisitionApi } from '../../services/apiServices';
import { PageHeader, Modal, Field, Spinner, SearchInput, EmptyState } from '../../components/ui';
import toast from 'react-hot-toast';

const emptyForm = {
  itemCode: '',
  quantity: 1,
  requiredBy: '',
  notes: ''
};

export default function PurchaseRequisitionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ['procurement-requisitions'],
    queryFn: () => purchaseRequisitionApi.list()
  });

  const create = useMutation({
    mutationFn: () => purchaseRequisitionApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setOpen(false);
      toast.success('Requisition created.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating requisition')
  });

  const approve = useMutation({
    mutationFn: (id: number) => purchaseRequisitionApi.updateStatus(id, 'APPROVED'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      toast.success('Approved.');
    }
  });

  const filtered = (data || []).filter((r: any) => 
    r.itemCode?.toLowerCase().includes(search.toLowerCase()) ||
    r.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (k: keyof typeof emptyForm) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Purchase Requisitions"
          subtitle={`${data.length} records`}
          actions={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search Requisitions..."
            />
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Requisitions</h1>
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
          <Plus size={15} /> Add Requisition
        </button>
      </div>

      <div className="hidden lg:flex justify-end -mt-14 mb-4">
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus size={15} /> Add Requisition
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
                    <th>Item Code</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Required By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-medium">PR-{r.id}</td>
                      <td>{r.itemCode}</td>
                      <td>{r.quantity}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {r.status || 'PENDING'}
                        </span>
                      </td>
                      <td>{r.requiredBy}</td>
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
                    <div className="font-semibold text-base">PR-{r.id}</div>
                    <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.status || 'PENDING'}
                    </span>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div><span className="text-gray-500">Item:</span> {r.itemCode}</div>
                    <div><span className="text-gray-500">Qty:</span> {r.quantity}</div>
                    <div><span className="text-gray-500">Required:</span> {r.requiredBy}</div>
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

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Requisition">
        <div className="space-y-3">
          <Field label="Item Code" required>
            <input className="input" value={form.itemCode} onChange={handleChange('itemCode')} />
          </Field>
          <Field label="Quantity" required>
            <input className="input" type="number" value={form.quantity} onChange={handleChange('quantity')} />
          </Field>
          <Field label="Required By Date">
            <input className="input" type="date" value={form.requiredBy} onChange={handleChange('requiredBy')} />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} value={form.notes} onChange={handleChange('notes')} />
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



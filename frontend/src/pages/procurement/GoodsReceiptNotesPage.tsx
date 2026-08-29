import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, FileText } from 'lucide-react';
import { goodsReceiptApi } from '../../services/apiServices';
import { PageHeader, Modal, Field, Spinner, SearchInput, EmptyState } from '../../components/ui';
import toast from 'react-hot-toast';

const emptyForm = {
  purchaseOrderId: '',
  receivedDate: '',
  notes: ''
};

export default function GoodsReceiptNotesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ['procurement-receipts'],
    queryFn: () => goodsReceiptApi.list()
  });

  const create = useMutation({
    mutationFn: () => goodsReceiptApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-receipts'] });
      setOpen(false);
      toast.success('Goods Receipt Note created.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating receipt')
  });

  const post = useMutation({
    mutationFn: (id: number) => goodsReceiptApi.updateStatus(id, 'POSTED'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-receipts'] });
      toast.success('Posted.');
    }
  });

  const filtered = (data || []).filter((r: any) => 
    r.purchaseOrderId?.toString().includes(search) ||
    r.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (k: keyof typeof emptyForm) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Goods Receipt Notes"
          subtitle={`${data.length} records`}
          actions={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search Receipts..."
            />
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Goods Receipt Notes</h1>
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
          <Plus size={15} /> Add GRN
        </button>
      </div>

      <div className="hidden lg:flex justify-end -mt-14 mb-4">
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus size={15} /> Add GRN
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
                    <th>Order ID</th>
                    <th>Received Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-medium">GRN-{r.id}</td>
                      <td>PO-{r.purchaseOrderId}</td>
                      <td>{r.receivedDate}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {r.status || 'DRAFT'}
                        </span>
                      </td>
                      <td>{r.notes}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-ghost btn-sm text-blue-600" title="View"><FileText size={15} /></button>
                          {r.status !== 'POSTED' && (
                            <button className="btn-ghost btn-sm text-green-600" title="Post" onClick={() => post.mutate(r.id)}>
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
                    <div className="font-semibold text-base">GRN-{r.id}</div>
                    <span className={`px-2 py-1 rounded-full text-xs ${r.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.status || 'DRAFT'}
                    </span>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div><span className="text-gray-500">Order ID:</span> PO-{r.purchaseOrderId}</div>
                    <div><span className="text-gray-500">Date:</span> {r.receivedDate}</div>
                  </div>
                  <div className="grid grid-cols-2 border-t">
                    <button className="flex items-center justify-center gap-2 py-3 text-blue-600 border-r">
                      <FileText size={16} /> View
                    </button>
                    {r.status !== 'POSTED' ? (
                      <button className="flex items-center justify-center gap-2 py-3 text-green-600" onClick={() => post.mutate(r.id)}>
                        <CheckCircle size={16} /> Post
                      </button>
                    ) : (
                       <div className="flex items-center justify-center gap-2 py-3 text-gray-400">Posted</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Goods Receipt Note">
        <div className="space-y-3">
          <Field label="Purchase Order ID" required>
            <input className="input" value={form.purchaseOrderId} onChange={handleChange('purchaseOrderId')} />
          </Field>
          <Field label="Received Date">
            <input className="input" type="date" value={form.receivedDate} onChange={handleChange('receivedDate')} />
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



import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, EmptyState, Spinner, Modal, Field, Confirm } from '../../components/ui';
import { stockAdjustmentApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function StockAdjustmentPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    adjustmentCode: '',
    warehouse: '',
    date: new Date().toISOString().split('T')[0],
    reason: 'Damage',
    status: 'Draft',
    notes: ''
  });

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => stockAdjustmentApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () => editingId ? stockAdjustmentApi.update(editingId, formData) : stockAdjustmentApi.create(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setModalOpen(false);
      toast.success(editingId ? 'Stock adjustment updated' : 'Stock adjustment created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save stock adjustment')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => stockAdjustmentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setDeleteId(null);
      toast.success('Stock adjustment deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete stock adjustment')
  });

  const filtered = useMemo(() => {
    return adjustments.filter((a: any) => 
      !search || a.adjustmentCode?.toLowerCase().includes(search.toLowerCase()) || 
      a.warehouse?.toLowerCase().includes(search.toLowerCase())
    );
  }, [adjustments, search]);

  const handleOpenCreate = () => {
    setFormData({ adjustmentCode: `ADJ-${Date.now().toString().slice(-4)}`, warehouse: '', date: new Date().toISOString().split('T')[0], reason: 'Damage', status: 'Draft', notes: '' });
    setEditingId(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setFormData({ ...item });
    setEditingId(item.id);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Adjustments"
        subtitle="Record inventory adjustments for damages, shrinkage, or discrepancies"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={16} /> New Adjustment
          </button>
        }
      />

      <div className="card p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 w-full text-sm"
            placeholder="Search adjustments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          {isLoading ? <Spinner /> : filtered.length === 0 ? (
            <EmptyState message="No stock adjustments found." />
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Adj ID</th>
                  <th>Date</th>
                  <th>Warehouse</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.adjustmentCode}</td>
                    <td>{a.date}</td>
                    <td>{a.warehouse}</td>
                    <td>{a.reason}</td>
                    <td>
                      <span className={`badge-${a.status === 'Approved' ? 'green' : 'gray'} text-xs`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewItem(a)} className="btn-ghost btn-sm p-1"><Eye size={15} /></button>
                        <button onClick={() => handleOpenEdit(a)} className="btn-ghost btn-sm p-1 text-blue-600"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteId(a.id)} className="btn-ghost btn-sm p-1 text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Adjustment' : 'New Adjustment'}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Field label="Adjustment Code" required>
            <input type="text" className="input" required value={formData.adjustmentCode} onChange={e => setFormData({...formData, adjustmentCode: e.target.value})} />
          </Field>
          <Field label="Warehouse" required>
            <input type="text" className="input" required value={formData.warehouse} onChange={e => setFormData({...formData, warehouse: e.target.value})} />
          </Field>
          <Field label="Date" required>
            <input type="date" className="input" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </Field>
          <Field label="Reason" required>
            <select className="input" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}>
              <option value="Damage">Damage</option>
              <option value="Shrinkage">Shrinkage</option>
              <option value="Discrepancy">Discrepancy</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Status" required>
            <select className="input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </Field>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">{saveMutation.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Adjustment Details">
        {viewItem && (
          <div className="space-y-4">
            <div><span className="text-gray-500">Code:</span> <span className="font-medium">{viewItem.adjustmentCode}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="badge-blue text-xs ml-2">{viewItem.status}</span></div>
            <div><span className="text-gray-500">Date:</span> <span>{viewItem.date}</span></div>
            <div><span className="text-gray-500">Warehouse:</span> <span>{viewItem.warehouse}</span></div>
            <div><span className="text-gray-500">Reason:</span> <span>{viewItem.reason}</span></div>
            {viewItem.notes && <div><span className="text-gray-500">Notes:</span> <p className="text-sm">{viewItem.notes}</p></div>}
            <div className="flex justify-end pt-4"><button type="button" onClick={() => setViewItem(null)} className="btn-secondary">Close</button></div>
          </div>
        )}
      </Modal>

      <Confirm open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} title="Delete Adjustment" message="Are you sure you want to delete this stock adjustment?" danger />
    </div>
  );
}

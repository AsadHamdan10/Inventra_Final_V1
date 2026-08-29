import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, EmptyState, Spinner, Modal, Field, Confirm } from '../../components/ui';
import { stockTransferApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function StockTransferPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    transferCode: '',
    sourceWarehouse: '',
    destWarehouse: '',
    transferDate: new Date().toISOString().split('T')[0],
    status: 'Draft',
    notes: ''
  });

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => stockTransferApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () => editingId ? stockTransferApi.update(editingId, formData) : stockTransferApi.create(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      setModalOpen(false);
      toast.success(editingId ? 'Stock transfer updated' : 'Stock transfer created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save stock transfer')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => stockTransferApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      setDeleteId(null);
      toast.success('Stock transfer deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete stock transfer')
  });

  const filtered = useMemo(() => {
    return transfers.filter((t: any) => 
      !search || t.transferCode?.toLowerCase().includes(search.toLowerCase()) || 
      t.sourceWarehouse?.toLowerCase().includes(search.toLowerCase()) || 
      t.destWarehouse?.toLowerCase().includes(search.toLowerCase())
    );
  }, [transfers, search]);

  const handleOpenCreate = () => {
    setFormData({ transferCode: `TRN-${Date.now().toString().slice(-4)}`, sourceWarehouse: '', destWarehouse: '', transferDate: new Date().toISOString().split('T')[0], status: 'Draft', notes: '' });
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
        title="Stock Transfers"
        subtitle="Manage and track stock movements between warehouses"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={16} /> New Transfer
          </button>
        }
      />

      <div className="card p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 w-full text-sm"
            placeholder="Search transfers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          {isLoading ? <Spinner /> : filtered.length === 0 ? (
            <EmptyState message="No stock transfers found." />
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Transfer ID</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.transferCode}</td>
                    <td>{t.transferDate}</td>
                    <td>{t.sourceWarehouse}</td>
                    <td>{t.destWarehouse}</td>
                    <td>
                      <span className={`badge-${t.status === 'Completed' ? 'green' : t.status === 'In Transit' ? 'blue' : 'gray'} text-xs`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewItem(t)} className="btn-ghost btn-sm p-1"><Eye size={15} /></button>
                        <button onClick={() => handleOpenEdit(t)} className="btn-ghost btn-sm p-1 text-blue-600"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteId(t.id)} className="btn-ghost btn-sm p-1 text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Transfer' : 'New Transfer'}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Field label="Transfer Code" required>
            <input type="text" className="input" required value={formData.transferCode} onChange={e => setFormData({...formData, transferCode: e.target.value})} />
          </Field>
          <Field label="Source Warehouse" required>
            <input type="text" className="input" required value={formData.sourceWarehouse} onChange={e => setFormData({...formData, sourceWarehouse: e.target.value})} />
          </Field>
          <Field label="Destination Warehouse" required>
            <input type="text" className="input" required value={formData.destWarehouse} onChange={e => setFormData({...formData, destWarehouse: e.target.value})} />
          </Field>
          <Field label="Transfer Date" required>
            <input type="date" className="input" required value={formData.transferDate} onChange={e => setFormData({...formData, transferDate: e.target.value})} />
          </Field>
          <Field label="Status" required>
            <select className="input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="Draft">Draft</option>
              <option value="In Transit">In Transit</option>
              <option value="Completed">Completed</option>
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

      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Transfer Details">
        {viewItem && (
          <div className="space-y-4">
            <div><span className="text-gray-500">Transfer Code:</span> <span className="font-medium">{viewItem.transferCode}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="badge-blue text-xs ml-2">{viewItem.status}</span></div>
            <div><span className="text-gray-500">Date:</span> <span>{viewItem.transferDate}</span></div>
            <div><span className="text-gray-500">Route:</span> <span>{viewItem.sourceWarehouse} &rarr; {viewItem.destWarehouse}</span></div>
            {viewItem.notes && <div><span className="text-gray-500">Notes:</span> <p className="text-sm">{viewItem.notes}</p></div>}
            <div className="flex justify-end pt-4"><button type="button" onClick={() => setViewItem(null)} className="btn-secondary">Close</button></div>
          </div>
        )}
      </Modal>

      <Confirm open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} title="Delete Transfer" message="Are you sure you want to delete this stock transfer?" danger />
    </div>
  );
}

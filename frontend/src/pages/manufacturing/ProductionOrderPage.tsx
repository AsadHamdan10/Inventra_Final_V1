import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play } from 'lucide-react';
import { productionOrderApi } from '../../services/apiServices';
import { PageHeader, Modal, Field, EmptyState, Spinner, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import ProductionExecutionModal from './ProductionExecutionModal';

export default function ProductionOrderPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orderNo: '' });
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data=[], isLoading } = useQuery({ queryKey:['productionorders'], queryFn:()=>productionOrderApi.list().catch(() => []) });
  
  const save = useMutation({
    mutationFn: () => productionOrderApi.create(form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['productionorders']}); setOpen(false); toast.success('Saved.'); },
    onError: () => toast.error('Error'),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Production Orders" subtitle={`${data.length} Orders`} />
      <div className="flex justify-end mb-4 -mt-14">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={15} /> Add Order
        </button>
      </div>
      
      <div className="table-container">
        {isLoading ? <Spinner /> : data.length === 0 ? <EmptyState /> : (
          <table className="table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b:any, i:number) => (
                <tr key={i}>
                  <td>{b.orderNo || `PO ${b.id}`}</td>
                  <td>
                    <Badge variant={b.status === 'RELEASED' || b.status === 'PARTIALLY_COMPLETED' ? 'green' : 'gray'}>
                      {b.status || 'DRAFT'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {(b.status === 'RELEASED' || b.status === 'PARTIALLY_COMPLETED' || !b.status) && (
                      <button 
                        className="btn-ghost text-primary" 
                        onClick={() => { setSelectedOrder(b); setExecModalOpen(true); }}
                        title="Execute"
                      >
                        <Play size={16} /> Execute
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="New Production Order">
        <div className="space-y-3">
          <Field label="Order No"><input className="input" value={form.orderNo} onChange={(e)=>setForm({orderNo: e.target.value})} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={()=>save.mutate()}>Save</button>
          </div>
        </div>
      </Modal>

      <ProductionExecutionModal
        open={execModalOpen}
        onClose={() => { setExecModalOpen(false); setSelectedOrder(null); }}
        order={selectedOrder}
      />
    </div>
  );
}

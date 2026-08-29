import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { routingApi } from '../../services/apiServices';
import { PageHeader, Modal, Field, EmptyState, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

export default function RoutingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '' });

  const { data=[], isLoading } = useQuery({ queryKey:['routings'], queryFn:()=>routingApi.list().catch(() => []) });
  
  const save = useMutation({
    mutationFn: () => routingApi.create(form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['routings']}); setOpen(false); toast.success('Saved.'); },
    onError: () => toast.error('Error'),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Routings" subtitle={`${data.length} Routings`} />
      <div className="flex justify-end mb-4 -mt-14">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={15} /> Add Routing
        </button>
      </div>
      
      <div className="table-container">
        {isLoading ? <Spinner /> : data.length === 0 ? <EmptyState /> : (
          <table className="table">
            <thead>
              <tr><th>Name</th></tr>
            </thead>
            <tbody>
              {data.map((b:any, i:number) => (
                <tr key={i}><td>{b.name || `Routing ${b.id}`}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="New Routing">
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e)=>setForm({name: e.target.value})} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={()=>save.mutate()}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

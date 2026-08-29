import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal, Field } from '../../components/ui';
import { productionOrderApi, materialApi, warehouseApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function ProductionExecutionModal({ open, onClose, order }: { open: boolean, onClose: () => void, order: any }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'issue' | 'receive'>('issue');
  const [issueForm, setIssueForm] = useState({ materialId: '', warehouseId: '', quantity: '' });
  const [receiveForm, setReceiveForm] = useState({ quantity: '' });

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => materialApi.list().catch(() => []) });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehouseApi.list().catch(() => []) });

  const startExec = useMutation({
    mutationFn: () => productionOrderApi.startExecution(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productionorders'] });
      toast.success('Execution started');
    },
    onError: () => toast.error('Failed to start execution')
  });

    const issueMat = useMutation({
    mutationFn: () => productionOrderApi.issueMaterial(order.executions?.[0]?.id || order.currentExecutionId || 1, { materialId: Number(issueForm.materialId), warehouseId: Number(issueForm.warehouseId), quantity: Number(issueForm.quantity) }),
    onSuccess: () => {
      toast.success('Material issued');
      setIssueForm({ materialId: '', warehouseId: '', quantity: '' });
      qc.invalidateQueries({ queryKey: ['productionorders'] });
    },
    onError: () => toast.error('Error issuing material')
  });

  const receiveFg = useMutation({
    mutationFn: () => productionOrderApi.recordOutput(order.executions?.[0]?.id || order.currentExecutionId || 1, { quantity: Number(receiveForm.quantity) }),
    onSuccess: () => {
      toast.success('Finished Goods received');
      setReceiveForm({ quantity: '' });
      qc.invalidateQueries({ queryKey: ['productionorders'] });
    },
    onError: () => toast.error('Error receiving FG')
  });

  if (!order) return null;

  const currentExecution = order.executions?.[0] || {};
  const wipActualCost = currentExecution.wipActualCost || 0; 
  const hasExecution = order.executions && order.executions.length > 0;

  return (
    <Modal open={open} onClose={onClose} title={`Execute Order: ${order.orderNo || order.id}`}>
      {!hasExecution ? (
        <div className="space-y-4">
          <p>No active execution found for this order.</p>
          <button className="btn-primary" onClick={() => startExec.mutate()} disabled={startExec.isPending}>
            {startExec.isPending ? 'Starting...' : 'Start Execution'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4 border-b pb-2">
            <button className={`pb-1 ${activeTab === 'issue' ? 'border-b-2 border-primary font-medium' : ''}`} onClick={() => setActiveTab('issue')}>Issue Materials</button>
            <button className={`pb-1 ${activeTab === 'receive' ? 'border-b-2 border-primary font-medium' : ''}`} onClick={() => setActiveTab('receive')}>Receive FG</button>
          </div>

          {activeTab === 'issue' && (
            <div className="space-y-3">
              <Field label="Material">
                <select className="input" value={issueForm.materialId} onChange={(e) => setIssueForm({ ...issueForm, materialId: e.target.value })}>
                  <option value="">Select Material</option>
                  {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Warehouse">
                <select className="input" value={issueForm.warehouseId} onChange={(e) => setIssueForm({ ...issueForm, warehouseId: e.target.value })}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" className="input" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} />
              </Field>
              <div className="flex justify-end pt-2">
                <button className="btn-primary" onClick={() => issueMat.mutate()} disabled={!issueForm.materialId || !issueForm.warehouseId || !issueForm.quantity || issueMat.isPending}>
                  {issueMat.isPending ? 'Issuing...' : 'Issue Material'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'receive' && (
            <div className="space-y-3">
              <Field label="Quantity">
                <input type="number" className="input" value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} />
              </Field>
              <div className="flex justify-end pt-2">
                <button className="btn-primary" onClick={() => receiveFg.mutate()} disabled={!receiveForm.quantity || receiveFg.isPending}>
                  {receiveFg.isPending ? 'Receiving...' : 'Receive Finished Goods'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t text-sm text-gray-600 dark:text-gray-400">
            <strong>WIP Actual Cost:</strong> ${Number(wipActualCost).toFixed(2)}
          </div>
        </div>
      )}
    </Modal>
  );
}







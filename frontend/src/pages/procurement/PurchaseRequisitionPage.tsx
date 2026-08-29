import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { purchaseRequisitionApi } from '../../services/apiServices';
import { PageHeader, EmptyState, Spinner } from '../../components/ui';

export default function PurchaseRequisitionPage() {
  const [search, setSearch] = useState('');

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['purchase-requisitions'],
    queryFn: () => purchaseRequisitionApi.list(),
  });

  const filtered = requisitions.filter((r: any) =>
    r.requisitionNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Manage purchase requisitions"
        actions={
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Requisition
          </button>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search requisitions..."
            className="input pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No Requisitions Found. Get started by creating a new purchase requisition." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Req. No</th>
                <th>Date</th>
                <th>Department</th>
                <th>Requested By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req: any) => (
                <tr key={req.id}>
                  <td>{req.requisitionNo}</td>
                  <td>{req.requisitionDate}</td>
                  <td>{req.department}</td>
                  <td>{req.requestedBy}</td>
                  <td>
                    <span className="badge badge-primary">{req.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


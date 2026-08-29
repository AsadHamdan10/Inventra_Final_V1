import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { purchaseOrderProcurementApi } from '../../services/apiServices';
import { PageHeader, EmptyState, Spinner } from '../../components/ui';

export default function PurchaseOrderPage() {
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => purchaseOrderProcurementApi.list(),
  });

  const filtered = orders.filter((o: any) =>
    o.orderNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders"
        actions={
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Order
          </button>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders..."
            className="input pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No Orders Found. Get started by creating a new purchase order." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Expected Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.orderNo}</td>
                  <td>{o.orderDate}</td>
                  <td>{o.vendorName}</td>
                  <td>{o.expectedDeliveryDate}</td>
                  <td>
                    <span className="badge badge-primary">{o.status}</span>
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



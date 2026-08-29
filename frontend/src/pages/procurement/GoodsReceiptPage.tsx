import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { goodsReceiptApi } from '../../services/apiServices';
import { PageHeader, EmptyState, Spinner } from '../../components/ui';

export default function GoodsReceiptPage() {
  const [search, setSearch] = useState('');

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => goodsReceiptApi.list(),
  });

  const filtered = receipts.filter((r: any) =>
    r.receiptNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipts"
        subtitle="Manage goods receipt notes (GRN)"
        actions={
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Receipt
          </button>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipts..."
            className="input pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No Receipts Found. Get started by creating a new goods receipt." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Date</th>
                <th>PO Ref</th>
                <th>Vendor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.receiptNo}</td>
                  <td>{r.receiptDate}</td>
                  <td>{r.purchaseOrderRef}</td>
                  <td>{r.vendorName}</td>
                  <td>
                    <span className="badge badge-primary">{r.status}</span>
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


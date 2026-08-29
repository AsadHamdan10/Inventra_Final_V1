import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { purchaseQuotationApi } from '../../services/apiServices';
import { PageHeader, EmptyState, Spinner } from '../../components/ui';

export default function PurchaseQuotationPage() {
  const [search, setSearch] = useState('');

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['purchase-quotations'],
    queryFn: () => purchaseQuotationApi.list(),
  });

  const filtered = quotations.filter((q: any) =>
    q.quotationNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Quotations"
        subtitle="Manage purchase quotations"
        actions={
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </button>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotations..."
            className="input pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No Quotations Found. Get started by creating a new purchase quotation." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Quotation No</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q: any) => (
                <tr key={q.id}>
                  <td>{q.quotationNo}</td>
                  <td>{q.quotationDate}</td>
                  <td>{q.vendorName}</td>
                  <td>{q.totalAmount}</td>
                  <td>
                    <span className="badge badge-primary">{q.status}</span>
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


import { useQuery } from '@tanstack/react-query';
// Material issue is generally part of execution, but if there's a dedicated page, we just list it or mock an API call here.
// I will just use productionOrderApi for issuing material. We can mock a list if needed.
import { productionOrderApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function MaterialIssuePage() {
  const [search, setSearch] = useState('');
  
  // As this is a generic material issue page, we mock the list for now if the API doesn't exist,
  // or you could use a specific endpoint if one is added.
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['materialIssues'],
    queryFn: () => Promise.resolve([]), // Mocked for now
  });

  const filtered = issues.filter((i: any) =>
    i.issueNumber?.toLowerCase().includes(search.toLowerCase()) ||
    i.productionOrder?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Material Issue"
          subtitle="Issue raw materials to production orders"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search..."
              />
              <button className="btn-primary">New Issue</button>
            </div>
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Material Issue</h1>
          <p className="text-gray-500 mt-1">Issue raw materials to production orders</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">New Issue</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No material issues found." />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Issue #</th>
                    <th>Date</th>
                    <th>Production Order</th>
                    <th>Material</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i: any) => (
                    <tr key={i.id || i.issueNumber}>
                      <td className="font-mono text-xs font-semibold">{i.issueNumber}</td>
                      <td>{new Date(i.date).toLocaleDateString()}</td>
                      <td>{i.productionOrder}</td>
                      <td>{i.materialName}</td>
                      <td>{i.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-3">
              {filtered.map((i: any) => (
                <div key={i.id || i.issueNumber} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{i.issueNumber}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(i.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-2 mt-2">
                    <div>
                      <p className="text-gray-500">Prod. Order</p>
                      <p className="font-medium">{i.productionOrder}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Material</p>
                      <p className="font-medium">{i.materialName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Quantity</p>
                      <p className="font-medium">{i.quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


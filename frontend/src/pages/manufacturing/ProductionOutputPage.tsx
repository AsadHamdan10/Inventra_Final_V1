import { useQuery } from '@tanstack/react-query';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function ProductionOutputPage() {
  const [search, setSearch] = useState('');
  
  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ['productionOutputs'],
    queryFn: () => Promise.resolve([]), // Mocked for now as there is no specific list API in execution
  });

  const filtered = outputs.filter((o: any) =>
    o.outputNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.productionOrder?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Production Output"
          subtitle="Record finished goods from production"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search..."
              />
              <button className="btn-primary">Record Output</button>
            </div>
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Production Output</h1>
          <p className="text-gray-500 mt-1">Record finished goods from production</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">Record</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No production outputs recorded yet." />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Output #</th>
                    <th>Date</th>
                    <th>Production Order</th>
                    <th>Material</th>
                    <th>Quantity Produced</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o: any) => (
                    <tr key={o.id || o.outputNumber}>
                      <td className="font-mono text-xs font-semibold">{o.outputNumber}</td>
                      <td>{new Date(o.date).toLocaleDateString()}</td>
                      <td>{o.productionOrder}</td>
                      <td>{o.materialName}</td>
                      <td>{o.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-3">
              {filtered.map((o: any) => (
                <div key={o.id || o.outputNumber} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{o.outputNumber}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(o.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-2 mt-2">
                    <div>
                      <p className="text-gray-500">Prod. Order</p>
                      <p className="font-medium">{o.productionOrder}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Material</p>
                      <p className="font-medium">{o.materialName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Quantity</p>
                      <p className="font-medium">{o.quantity}</p>
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

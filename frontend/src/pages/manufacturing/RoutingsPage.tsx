import { useQuery } from '@tanstack/react-query';
import { routingApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function RoutingsPage() {
  const [search, setSearch] = useState('');
  const { data: routings = [], isLoading } = useQuery({
    queryKey: ['routings'],
    queryFn: () => routingApi.list(),
  });

  const filtered = routings.filter((r: any) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Routings"
          subtitle="Manage manufacturing production routings"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search Routings..."
              />
              <button className="btn-primary">Create Routing</button>
            </div>
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Routings</h1>
          <p className="text-gray-500 mt-1">Manage manufacturing production routings</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Routings..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">Create</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No routings found." />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Material</th>
                    <th>Total Operations</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id || r.code}>
                      <td className="font-mono text-xs font-semibold">{r.code}</td>
                      <td className="font-medium">{r.name}</td>
                      <td>{r.materialName || '—'}</td>
                      <td>{r.operations?.length || 0} Operations</td>
                      <td>
                        {r.isActive !== false ? (
                          <span className="badge-green text-xs">Active</span>
                        ) : (
                          <span className="badge-red text-xs">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-3">
              {filtered.map((r: any) => (
                <div key={r.id || r.code} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{r.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{r.code}</div>
                    </div>
                    {r.isActive !== false ? (
                      <span className="badge-green text-xs">Active</span>
                    ) : (
                      <span className="badge-red text-xs">Inactive</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-2 mt-2">
                    <div>
                      <p className="text-gray-500">Material</p>
                      <p className="font-medium">{r.materialName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Operations</p>
                      <p className="font-medium">{r.operations?.length || 0}</p>
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

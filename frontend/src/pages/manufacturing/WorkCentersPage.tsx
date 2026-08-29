import { useQuery } from '@tanstack/react-query';
import { workCenterApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function WorkCentersPage() {
  const [search, setSearch] = useState('');
  const { data: workCenters = [], isLoading } = useQuery({
    queryKey: ['workCenters'],
    queryFn: () => workCenterApi.list(),
  });

  const filtered = workCenters.filter((w: any) =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <PageHeader
          title="Work Centers"
          subtitle="Manage production work centers"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search Work Centers..."
              />
              <button className="btn-primary">Add Work Center</button>
            </div>
          }
        />
      </div>

      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Work Centers</h1>
          <p className="text-gray-500 mt-1">Manage production work centers</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Work Centers..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">Add</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No work centers found." />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Hourly Cost</th>
                    <th>Capacity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w: any) => (
                    <tr key={w.id || w.code}>
                      <td className="font-mono text-xs font-semibold">{w.code}</td>
                      <td className="font-medium">{w.name}</td>
                      <td>₹{w.hourlyCost || '0'}</td>
                      <td>{w.capacity || '0'} hours/day</td>
                      <td>
                        {w.isActive !== false ? (
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
              {filtered.map((w: any) => (
                <div key={w.id || w.code} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{w.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{w.code}</div>
                    </div>
                    {w.isActive !== false ? (
                      <span className="badge-green text-xs">Active</span>
                    ) : (
                      <span className="badge-red text-xs">Inactive</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-2 mt-2">
                    <div>
                      <p className="text-gray-500">Hourly Cost</p>
                      <p className="font-semibold">₹{w.hourlyCost || '0'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Capacity</p>
                      <p className="font-semibold">{w.capacity || '0'} hrs/day</p>
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

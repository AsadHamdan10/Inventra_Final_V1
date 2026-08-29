import { useQuery } from '@tanstack/react-query';
import { chartOfAccountsApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.list(),
  });

  const filtered = accounts.filter((a: any) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.code?.includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Desktop Only */}
      <div className="hidden lg:block">
        <PageHeader
          title="Chart of Accounts"
          subtitle="Manage your company's accounting structure"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search Accounts..."
              />
              <button className="btn-primary">Add Account</button>
            </div>
          }
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your company's accounting structure</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Accounts..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">Add</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No accounts found." />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th>Subtype</th>
                    <th className="text-right">Current Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a: any) => (
                    <tr key={a.id || a.code}>
                      <td className="font-mono text-xs">{a.code}</td>
                      <td className="font-medium">{a.name}</td>
                      <td>{a.type}</td>
                      <td>{a.subType || '—'}</td>
                      <td className="text-right font-semibold">
                        ₹{a.balance?.toLocaleString() || '0'}
                      </td>
                      <td>
                        {a.isActive !== false ? (
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

            {/* Mobile + Tablet */}
            <div className="lg:hidden space-y-3">
              {filtered.map((a: any) => (
                <div key={a.id || a.code} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{a.name}</div>
                      <div className="text-xs font-mono text-gray-500 mt-1">Code: {a.code}</div>
                    </div>
                    {a.isActive !== false ? (
                      <span className="badge-green text-xs">Active</span>
                    ) : (
                      <span className="badge-red text-xs">Inactive</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium">{a.type}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Subtype</p>
                      <p>{a.subType || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Balance</p>
                      <p className="font-semibold">₹{a.balance?.toLocaleString() || '0'}</p>
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

import { useQuery } from '@tanstack/react-query';
import { journalEntryApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { useState } from 'react';

export default function JournalEntriesPage() {
  const [search, setSearch] = useState('');
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => journalEntryApi.list(),
  });

  const filtered = entries.filter((e: any) =>
    e.entryNumber?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Desktop Only */}
      <div className="hidden lg:block">
        <PageHeader
          title="Journal Entries"
          subtitle="Record and view manual journal entries"
          actions={
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search Entries..."
              />
              <button className="btn-primary">New Entry</button>
            </div>
          }
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Journal Entries</h1>
          <p className="text-gray-500 mt-1">Record and view manual journal entries</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Entries..."
            className="input flex-1"
          />
          <button className="btn-primary whitespace-nowrap">New Entry</button>
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="No journal entries found." />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Entry #</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="text-right">Total Debit</th>
                    <th className="text-right">Total Credit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e: any) => (
                    <tr key={e.id || e.entryNumber}>
                      <td className="font-mono text-xs font-semibold">{e.entryNumber}</td>
                      <td>{new Date(e.date).toLocaleDateString()}</td>
                      <td>{e.description || '—'}</td>
                      <td className="text-right">
                        ₹{e.totalDebit?.toLocaleString() || '0'}
                      </td>
                      <td className="text-right">
                        ₹{e.totalCredit?.toLocaleString() || '0'}
                      </td>
                      <td>
                        {e.status === 'POSTED' ? (
                          <span className="badge-green text-xs">Posted</span>
                        ) : e.status === 'DRAFT' ? (
                          <span className="badge-yellow text-xs">Draft</span>
                        ) : (
                          <span className="badge-red text-xs">Void</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile + Tablet */}
            <div className="lg:hidden space-y-3">
              {filtered.map((e: any) => (
                <div key={e.id || e.entryNumber} className="card overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{e.entryNumber}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                    </div>
                    {e.status === 'POSTED' ? (
                      <span className="badge-green text-xs">Posted</span>
                    ) : e.status === 'DRAFT' ? (
                      <span className="badge-yellow text-xs">Draft</span>
                    ) : (
                      <span className="badge-red text-xs">Void</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{e.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-2 mt-2">
                    <div>
                      <p className="text-gray-500">Total Debit</p>
                      <p className="font-semibold">₹{e.totalDebit?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Credit</p>
                      <p className="font-semibold">₹{e.totalCredit?.toLocaleString() || '0'}</p>
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

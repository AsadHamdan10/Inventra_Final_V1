import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner } from '../../components/ui';
import { format } from 'date-fns';

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ 
    queryKey: ['admin-audit-logs', page], 
    queryFn: () => adminApi.getAuditLogs(page),
    /* keepPreviousData: true */
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Audit Logs" subtitle="Global security and administrative event stream" />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        {isLoading && !data ? (
          <div className="p-10 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="p-4 font-semibold w-48">Timestamp</th>
                    <th className="p-4 font-semibold w-48">Actor (Tenant)</th>
                    <th className="p-4 font-semibold w-64">Action</th>
                    <th className="p-4 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {((data as any)?.logs || []).map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25">
                      <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                        {log.user?.username || 'System'}
                      </td>
                      <td className="p-4 text-sm font-semibold text-brand-600 dark:text-brand-400">
                        {log.action}
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-300 break-words max-w-md">
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))}
                  {!data?.logs?.length && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">No logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
              <span className="text-sm text-slate-500">
                Page {(data as any)?.page}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  disabled={!data?.logs?.length || (data as any).logs.length < ((data as any).limit || 50)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

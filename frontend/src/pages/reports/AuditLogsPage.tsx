import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { adminApi } from '../../services/apiServices';
import { PageHeader, Spinner, EmptyState } from '../../components/ui';
import { format } from 'date-fns';
import { Shield } from 'lucide-react';

const ACTION_COLORS: Record<string,string> = {
  login:'badge-green', logout:'badge-gray', data_create:'badge-blue', data_update:'badge-purple',
  data_delete:'badge-red', failed_login:'badge-red', user_approved:'badge-green',
  user_suspended:'badge-yellow', password_change:'badge-blue', admin_password_reset:'badge-yellow',
};

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [search,setSearch]=useState('');
  const isAdmin = user?.role === 'super_admin';

  const {data:logs=[],isLoading}=useQuery({
    queryKey:['audit-logs'],
    queryFn:()=>isAdmin?adminApi.getAuditLogs():api.get('/audit').then(r=>r.data),
  });

  const filtered=search?logs.filter((l:any)=>
    l.action?.toLowerCase().includes(search.toLowerCase())||
    l.details?.toLowerCase().includes(search.toLowerCase())||
    l.user?.companyName?.toLowerCase().includes(search.toLowerCase())
  ):logs;

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" subtitle="Complete system activity trail"
        actions={<input className="input w-56 text-sm" placeholder="Search action, user, details…" value={search} onChange={e=>setSearch(e.target.value)}/>}/>
      {isAdmin&&(
        <div className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg px-3 py-2">
          <Shield size={13}/> Showing all tenant logs (Super Admin view)
        </div>
      )}
      <div className="table-container">
        {isLoading?<Spinner/>:filtered.length===0?<EmptyState message="No audit logs found."/>:(
          <table className="table">
            <thead><tr>
              {isAdmin&&<th>User / Company</th>}
              <th>Action</th><th>Details</th><th>IP Address</th><th>Date & Time</th>
            </tr></thead>
            <tbody>{filtered.map((l:any)=>(
              <tr key={l.id}>
                {isAdmin&&<td className="text-sm"><div className="font-medium">{l.user?.companyName||'System'}</div><div className="text-xs text-gray-400">@{l.user?.username||'—'}</div></td>}
                <td><span className={`${ACTION_COLORS[l.action]||'badge-gray'} text-xs font-mono`}>{l.action}</span></td>
                <td className="text-sm text-gray-600 dark:text-gray-400 max-w-[250px] truncate">{l.details||'—'}</td>
                <td className="font-mono text-xs text-gray-400">{l.ipAddress||'—'}</td>
                <td className="text-xs text-gray-500">{format(new Date(l.createdAt),'dd/MM/yyyy HH:mm:ss')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

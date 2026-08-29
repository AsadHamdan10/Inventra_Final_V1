import React, { useState, useEffect } from 'react';
import { gstFilingApi } from '../../services/apiServices';
import { useAuthStore } from '../../store/authStore';

const GstFilingDashboard: React.FC = () => {
  const [returns, setReturns] = useState<any[]>([]);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [returnType, setReturnType] = useState('GSTR1');
  const [error, setError] = useState('');

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const data = await gstFilingApi.list();
      setReturns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handlePrepare = async (e: any) => {
    e.preventDefault();
    try {
      await gstFilingApi.prepare({ returnType, month, year });
      fetchReturns();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleFile = async (id: number) => {
    if (!confirm('Are you sure? Once filed, this cannot be undone.')) return;
    try {
      await gstFilingApi.file(id);
      fetchReturns();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
      fetchReturns(); // Refresh status if it became stale
    }
  };

  const handleReconcile = async (id: number) => {
    try {
      await gstFilingApi.reconcile(id);
      fetchReturns();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleReady = async (id: number) => {
    try {
      await gstFilingApi.markReady(id);
      fetchReturns();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">GST Returns & Filing</h1>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">MOCK PROVIDER ENABLED</span>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Prepare New Return</h2>
        <form onSubmit={handlePrepare} className="flex gap-4 items-end">
          <div>
            <label className="block text-sm">Return Type</label>
            <select className="border p-2 rounded" value={returnType} onChange={e => setReturnType(e.target.value)}>
              <option value="GSTR1">GSTR-1</option>
              <option value="GSTR3B">GSTR-3B</option>
            </select>
          </div>
          <div>
            <label className="block text-sm">Month</label>
            <input type="number" min="1" max="12" className="border p-2 rounded" value={month} onChange={e => setMonth(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm">Year</label>
            <input type="number" min="2020" max="2100" className="border p-2 rounded" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Prepare</button>
        </form>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ack No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {returns.map(r => (
              <tr key={r.id}>
                <td className="px-6 py-4">{r.periodMonth}/{r.periodYear}</td>
                <td className="px-6 py-4">{r.returnType}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    r.status === 'FILED' ? 'bg-green-100 text-green-800' :
                    r.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    r.status === 'READY_TO_FILE' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {r.status}
                  </span>
                  {r.errorDetails && <div className="text-red-500 text-xs mt-1">Has Errors</div>}
                </td>
                <td className="px-6 py-4">{r.ackNo || '-'}</td>
                <td className="px-6 py-4 flex gap-2">
                  {r.status === 'DRAFT' && <button onClick={() => handleReconcile(r.id)} className="text-blue-600">Reconcile</button>}
                  {r.status === 'RECONCILED' && <button onClick={() => handleReady(r.id)} className="text-indigo-600">Mark Ready</button>}
                  {r.status === 'READY_TO_FILE' && <button onClick={() => handleFile(r.id)} className="text-green-600 font-bold">FILE</button>}
                  {r.status === 'FAILED' && <button onClick={() => handleFile(r.id)} className="text-orange-600">Retry</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default GstFilingDashboard;

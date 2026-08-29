import React, { useState, useEffect } from 'react';
import { eWayBillApi, saleApi } from '../../services/apiServices';
import { useAuthStore } from '../../store/authStore';
import { Truck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const EWayBillPage: React.FC = () => {
  const { user } = useAuthStore();
  const [ewbs, setEwbs] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selectedEwb, setSelectedEwb] = useState<any>(null);

  // Form states
  const [sourceType, setSourceType] = useState('SALE');
  const [sourceId, setSourceId] = useState('');
  const [transportMode, setTransportMode] = useState('1');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [approxDistance, setApproxDistance] = useState('100');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchEwbs = async () => {
    try {
      const data = await eWayBillApi.list();
      setEwbs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSales = async () => {
    try {
      const data = await saleApi.list();
      setSales(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEwbs();
    fetchSales();
    setLoading(false);
  }, []);

  const handleGenerate = async (e: any) => {
    e.preventDefault();
    setError(null);
    try {
      await eWayBillApi.generate(sourceType, Number(sourceId), {
        transportMode,
        vehicleNo,
        transporterId,
        approximateDistance: Number(approxDistance)
      });
      setShowGenerate(false);
      fetchEwbs();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleCancel = async (e: any) => {
    e.preventDefault();
    setError(null);
    try {
      await eWayBillApi.cancel(selectedEwb.id, cancelReason);
      setShowCancel(false);
      fetchEwbs();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const openCancel = (ewb: any) => {
    setSelectedEwb(ewb);
    setCancelReason('');
    setError(null);
    setShowCancel(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">E-Way Bill Compliance</h1>
          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">MOCK / DEVELOPMENT MODE - Not Connected to Real IRP</span>
        </div>
        {['admin', 'super_admin'].includes(user?.role || '') && (
          <button onClick={() => setShowGenerate(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
            Generate E-Way Bill
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">Total Generated</h3>
          <p className="text-2xl font-bold">{ewbs.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-green-500 text-sm">Active</h3>
          <p className="text-2xl font-bold">{ewbs.filter(e => e.status === 'GENERATED').length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-red-500 text-sm">Cancelled</h3>
          <p className="text-2xl font-bold">{ewbs.filter(e => e.status === 'CANCELLED').length}</p>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EWB No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ewbs.map((ewb) => (
              <tr key={ewb.id}>
                <td className="px-6 py-4 whitespace-nowrap">{ewb.ewbNo || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{ewb.documentNo}</td>
                <td className="px-6 py-4 whitespace-nowrap">{ewb.documentDate ? new Date(ewb.documentDate).toLocaleDateString() : 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{ewb.vehicleNo || ewb.transporterId || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    ewb.status === 'GENERATED' ? 'bg-green-100 text-green-800' :
                    ewb.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ewb.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {ewb.status === 'GENERATED' && ['admin', 'super_admin'].includes(user?.role || '') && (
                    <button onClick={() => openCancel(ewb)} className="text-red-600 hover:text-red-900">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showGenerate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">Generate E-Way Bill</h3>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <form onSubmit={handleGenerate}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Select Sale</label>
                <select className="shadow border rounded w-full py-2 px-3 text-gray-700" value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
                  <option value="">-- Select --</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.id}>{s.invoiceNo}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Distance (km)</label>
                <input type="number" className="shadow border rounded w-full py-2 px-3" value={approxDistance} onChange={(e) => setApproxDistance(e.target.value)} required />
              </div>
              <div className="flex justify-end mt-4">
                <button type="button" onClick={() => setShowGenerate(false)} className="mr-2 px-4 py-2 text-gray-500">Close</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">Cancel E-Way Bill</h3>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <form onSubmit={handleCancel}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Reason</label>
                <input type="text" className="shadow border rounded w-full py-2 px-3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
              </div>
              <div className="flex justify-end mt-4">
                <button type="button" onClick={() => setShowCancel(false)} className="mr-2 px-4 py-2 text-gray-500">Close</button>
                <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EWayBillPage;

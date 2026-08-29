import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, MapPin, Building2, Package } from 'lucide-react';
import { PageHeader, EmptyState, Spinner, Modal, StatCard } from '../../components/ui';
import { warehouseApi } from '../../services/apiServices';

export default function WarehousePage() {
  const [search, setSearch] = useState('');
  const [viewItem, setViewItem] = useState<any | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.list(),
  });

  const filtered = useMemo(() => {
    return warehouses.filter((w: any) => 
      !search || w.warehouseName?.toLowerCase().includes(search.toLowerCase()) || 
      w.warehouseCode?.toLowerCase().includes(search.toLowerCase()) ||
      w.city?.toLowerCase().includes(search.toLowerCase())
    );
  }, [warehouses, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Warehouses"
        subtitle="View stock locations and their current capacities"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Warehouses" value={warehouses.length} icon={Building2} color="blue" />
        <StatCard label="Active Locations" value={warehouses.filter((w: any) => w.status === 'active').length} icon={MapPin} color="green" />
        <StatCard label="Total Stored Items" value={warehouses.reduce((acc: number, w: any) => acc + (Number(w.totalItemsStored) || 0), 0)} icon={Package} color="indigo" />
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 w-full text-sm"
            placeholder="Search warehouses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          {isLoading ? <Spinner /> : filtered.length === 0 ? (
            <EmptyState message="No warehouses found." />
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Warehouse Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Total Items</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w: any) => (
                  <tr key={w.id}>
                    <td className="font-medium">{w.warehouseCode}</td>
                    <td className="font-semibold text-gray-900 dark:text-gray-100">{w.warehouseName}</td>
                    <td>{w.warehouseType}</td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin size={13} className="text-gray-400" />
                        <span>{w.city || '—'}</span>
                      </div>
                    </td>
                    <td>{w.totalItemsStored || 0}</td>
                    <td>
                      <span className={`badge-${w.status === 'active' ? 'green' : 'gray'} text-xs`}>
                        {w.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewItem(w)} className="btn-ghost btn-sm p-1"><Eye size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Warehouse Details">
        {viewItem && (
          <div className="space-y-4">
            <div><span className="text-gray-500">Name:</span> <span className="font-medium">{viewItem.warehouseName}</span></div>
            <div><span className="text-gray-500">Code:</span> <span>{viewItem.warehouseCode}</span></div>
            <div><span className="text-gray-500">Type:</span> <span>{viewItem.warehouseType}</span></div>
            <div><span className="text-gray-500">Location:</span> <span>{viewItem.city}{viewItem.state ? `, ${viewItem.state}` : ''}</span></div>
            <div><span className="text-gray-500">Capacity:</span> <span>{viewItem.capacity || 'Standard'}</span></div>
            <div><span className="text-gray-500">Total Items Stored:</span> <span>{viewItem.totalItemsStored || 0}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className={`badge-${viewItem.status === 'active' ? 'green' : 'gray'} text-xs ml-2`}>{viewItem.status}</span></div>
            {viewItem.notes && <div><span className="text-gray-500">Notes:</span> <p className="text-sm">{viewItem.notes}</p></div>}
            <div className="flex justify-end pt-4"><button type="button" onClick={() => setViewItem(null)} className="btn-secondary">Close</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

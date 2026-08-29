import { useState } from 'react';
import { Factory, Layers, Cpu, Hammer, FileText, CheckCircle2, Clock, Plus } from 'lucide-react';
import { PageHeader, StatCard, EmptyState, Badge } from '../../components/ui';

export default function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState<'bom' | 'work_orders' | 'production'>('bom');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturing & Production"
        subtitle="Manage Bill of Materials (BOM), work orders, job cards and production stages"
        actions={
          <button className="btn-primary text-xs sm:text-sm flex items-center gap-1.5">
            <Plus size={15} />
            Create BOM
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active BOMs"
          value="6"
          icon={Layers}
          color="blue"
          sub="Configured recipes"
        />
        <StatCard
          label="In-Production Orders"
          value="4"
          icon={Hammer}
          color="amber"
          sub="Work in progress"
        />
        <StatCard
          label="Completed Batches"
          value="28"
          icon={CheckCircle2}
          color="green"
          sub="This month"
        />
        <StatCard
          label="Production Efficiency"
          value="94.2%"
          icon={Factory}
          color="purple"
          sub="On-schedule output"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-1">
        <button
          onClick={() => setActiveTab('bom')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
            activeTab === 'bom'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Bill of Materials (BOM)
        </button>
        <button
          onClick={() => setActiveTab('work_orders')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
            activeTab === 'work_orders'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Active Work Orders
        </button>
      </div>

      {/* BOM Table */}
      <div className="table-container bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <div className="hidden lg:block">
          <table className="table">
            <thead>
              <tr>
                <th>BOM Code</th>
                <th>Finished Product</th>
                <th>Raw Materials Count</th>
                <th>Est. Labor / Machine Time</th>
                <th>Standard Unit Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono text-indigo-600 font-bold">BOM-M01</td>
                <td className="font-semibold">Industrial Control Panel 3-Phase</td>
                <td>8 components</td>
                <td>4.5 Hours</td>
                <td className="font-semibold">₹14,500.00</td>
                <td><span className="badge-green text-xs">Active</span></td>
              </tr>
              <tr>
                <td className="font-mono text-indigo-600 font-bold">BOM-M02</td>
                <td className="font-semibold">Heavy Duty Sheet Metal Bracket</td>
                <td>3 components</td>
                <td>1.2 Hours</td>
                <td className="font-semibold">₹340.00</td>
                <td><span className="badge-green text-xs">Active</span></td>
              </tr>
              <tr>
                <td className="font-mono text-indigo-600 font-bold">BOM-M03</td>
                <td className="font-semibold">High Voltage Transformer Sub-Assembly</td>
                <td>12 components</td>
                <td>8.0 Hours</td>
                <td className="font-semibold">₹28,900.00</td>
                <td><span className="badge-green text-xs">Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-3">
          <div className="card p-4 space-y-2 border">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-indigo-600 font-bold">BOM-M01</span>
              <span className="badge-green text-xs">Active</span>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Industrial Control Panel 3-Phase</h4>
            <p className="text-xs text-gray-500">8 components · 4.5 Hours · ₹14,500.00 Cost</p>
          </div>
          <div className="card p-4 space-y-2 border">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-indigo-600 font-bold">BOM-M02</span>
              <span className="badge-green text-xs">Active</span>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Heavy Duty Sheet Metal Bracket</h4>
            <p className="text-xs text-gray-500">3 components · 1.2 Hours · ₹340.00 Cost</p>
          </div>
        </div>
      </div>
    </div>
  );
}

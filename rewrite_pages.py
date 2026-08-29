
import os

bom_page = """import React, { useEffect, useState } from "react";
import { bomApi } from "../../services/apiServices";
import { PageHeader, Spinner, Badge } from "../../components/ui";
import toast from "react-hot-toast";

export function BomPage() {
    const [boms, setBoms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        bomApi.list().then(setBoms).finally(() => setLoading(false));
    }, []);

    const activate = async (id: number) => {
        try {
            await bomApi.activate(id);
            toast.success("BOM Activated");
            bomApi.list().then(setBoms);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Error activating BOM");
        }
    };

    return (
        <div className="space-y-4">
            <PageHeader title="Bill of Materials" />
            {loading ? <Spinner /> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-100 uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Revision</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {boms.map((b) => (
                                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{b.bomCode}</td>
                                    <td className="px-4 py-3">{b.finishedGoodItem?.materialName || "Unknown"}</td>
                                    <td className="px-4 py-3">{b.revision}</td>
                                    <td className="px-4 py-3"><Badge variant={b.status === "ACTIVE" ? "green" : "gray"}>{b.status}</Badge></td>
                                    <td className="px-4 py-3">
                                        {b.status === "DRAFT" && (
                                            <button onClick={() => activate(b.id)} className="text-blue-600 hover:underline">Activate</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {boms.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No BOMs found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
"""

po_page = """import React, { useEffect, useState } from "react";
import { productionOrderApi } from "../../services/apiServices";
import { PageHeader, Spinner, Badge } from "../../components/ui";
import toast from "react-hot-toast";

export function ProductionOrderPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        productionOrderApi.list().then(setOrders).finally(() => setLoading(false));
    }, []);

    const release = async (id: number) => {
        try {
            await productionOrderApi.release(id);
            toast.success("Order Released");
            productionOrderApi.list().then(setOrders);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Error releasing order");
        }
    };

    return (
        <div className="space-y-4">
            <PageHeader title="Production Orders" />
            {loading ? <Spinner /> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-100 uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3">Order No</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Planned Qty</th>
                                <th className="px-4 py-3">Completed Qty</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {orders.map((o) => (
                                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{o.productionOrderNo}</td>
                                    <td className="px-4 py-3">{o.item?.materialName || "Unknown"}</td>
                                    <td className="px-4 py-3">{o.plannedQuantity}</td>
                                    <td className="px-4 py-3">{o.completedQuantity}</td>
                                    <td className="px-4 py-3"><Badge variant={o.status === "RELEASED" ? "blue" : o.status === "COMPLETED" ? "green" : "gray"}>{o.status}</Badge></td>
                                    <td className="px-4 py-3">
                                        {o.status === "DRAFT" && (
                                            <button onClick={() => release(o.id)} className="text-blue-600 hover:underline">Release</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No Orders found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
"""

with open("frontend/src/pages/manufacturing/BomPage.tsx", "w", encoding="utf-8") as f: f.write(bom_page)
with open("frontend/src/pages/manufacturing/ProductionOrderPage.tsx", "w", encoding="utf-8") as f: f.write(po_page)


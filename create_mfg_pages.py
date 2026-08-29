
import os

os.makedirs("frontend/src/pages/manufacturing", exist_ok=True)

bom_page = """import React, { useEffect, useState } from "react";
import { bomApi } from "../../services/apiServices";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

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

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Bill of Materials</h1>
            <Card>
                <CardHeader><CardTitle>Active & Draft BOMs</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Revision</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {boms.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell>{b.bomCode}</TableCell>
                                    <TableCell>{b.finishedGoodItem?.materialName || "Unknown"}</TableCell>
                                    <TableCell>{b.revision}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${b.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                            {b.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {b.status === "DRAFT" && (
                                            <button onClick={() => activate(b.id)} className="text-blue-600 hover:underline text-sm">Activate</button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
"""

po_page = """import React, { useEffect, useState } from "react";
import { productionOrderApi } from "../../services/apiServices";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

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

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Production Orders</h1>
            <Card>
                <CardHeader><CardTitle>Manufacturing Orders</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order No</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Planned Qty</TableHead>
                                <TableHead>Completed Qty</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((o) => (
                                <TableRow key={o.id}>
                                    <TableCell>{o.productionOrderNo}</TableCell>
                                    <TableCell>{o.item?.materialName || "Unknown"}</TableCell>
                                    <TableCell>{o.plannedQuantity}</TableCell>
                                    <TableCell>{o.completedQuantity}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${o.status === "RELEASED" ? "bg-blue-100 text-blue-800" : o.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                            {o.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {o.status === "DRAFT" && (
                                            <button onClick={() => release(o.id)} className="text-blue-600 hover:underline text-sm">Release</button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
"""

with open("frontend/src/pages/manufacturing/BomPage.tsx", "w", encoding="utf-8") as f: f.write(bom_page)
with open("frontend/src/pages/manufacturing/ProductionOrderPage.tsx", "w", encoding="utf-8") as f: f.write(po_page)


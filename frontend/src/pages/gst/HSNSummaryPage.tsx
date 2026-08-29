import React, { useEffect, useState } from 'react';
import { gstApi } from '../../services/apiServices';

export default function HSNSummaryPage() {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        gstApi.getHSNSummary().then(res => setData(res.data)).catch(console.error);
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">HSN/SAC Summary</h1>
            <div className="overflow-x-auto shadow rounded border">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 text-left">HSN/SAC</th>
                            <th className="border p-2 text-right">Qty</th>
                            <th className="border p-2 text-right">Taxable</th>
                            <th className="border p-2 text-right">IGST</th>
                            <th className="border p-2 text-right">CGST</th>
                            <th className="border p-2 text-right">SGST</th>
                            <th className="border p-2 text-right">Total GST</th>
                            <th className="border p-2 text-center">Invoices</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="border p-2 font-semibold">{r.hsnSac}</td>
                                <td className="border p-2 text-right">{r.quantity}</td>
                                <td className="border p-2 text-right">{r.taxableValue}</td>
                                <td className="border p-2 text-right">{r.igst}</td>
                                <td className="border p-2 text-right">{r.cgst}</td>
                                <td className="border p-2 text-right">{r.sgst}</td>
                                <td className="border p-2 text-right font-bold">{r.totalGST}</td>
                                <td className="border p-2 text-center">{r.invoices}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
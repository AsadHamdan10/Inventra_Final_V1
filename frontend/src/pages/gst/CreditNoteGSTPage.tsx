import React, { useEffect, useState } from 'react';
import { gstApi } from '../../services/apiServices';

export default function CreditNoteGSTPage() {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        gstApi.getCreditNotes().then(res => setData(res.data)).catch(console.error);
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Credit Notes (Sales Returns)</h1>
            <div className="overflow-x-auto shadow rounded border">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 text-left">CN No</th>
                            <th className="border p-2 text-left">Date</th>
                            <th className="border p-2 text-left">Orig Inv</th>
                            <th className="border p-2 text-left">Customer</th>
                            <th className="border p-2 text-left">GSTIN</th>
                            <th className="border p-2 text-right">Taxable</th>
                            <th className="border p-2 text-right">IGST</th>
                            <th className="border p-2 text-right">CGST</th>
                            <th className="border p-2 text-right">SGST</th>
                            <th className="border p-2 text-right">Total GST</th>
                            <th className="border p-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="border p-2">{r.creditNoteNo}</td>
                                <td className="border p-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                                <td className="border p-2">{r.originalInvoiceNo}</td>
                                <td className="border p-2">{r.customerName}</td>
                                <td className="border p-2">{r.customerGSTIN || 'N/A'}</td>
                                <td className="border p-2 text-right">{r.taxableValue}</td>
                                <td className="border p-2 text-right">{r.igst}</td>
                                <td className="border p-2 text-right">{r.cgst}</td>
                                <td className="border p-2 text-right">{r.sgst}</td>
                                <td className="border p-2 text-right font-bold">{r.totalGST}</td>
                                <td className="border p-2 text-center">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
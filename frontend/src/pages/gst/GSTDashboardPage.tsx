import React, { useEffect, useState } from 'react';
import { gstApi } from '../../services/apiServices';

export default function GSTDashboardPage() {
    const [summary, setSummary] = useState<any>(null);
    const [warnings, setWarnings] = useState<any[]>([]);

    useEffect(() => {
        gstApi.getSummary().then(res => setSummary(res.data)).catch(console.error);
        gstApi.getWarnings().then(res => setWarnings(res.data)).catch(console.error);
    }, []);

    if (!summary) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">GST Dashboard</h1>
            
            {warnings.length > 0 && (
                <div className="bg-orange-100 text-orange-800 p-4 mb-6 rounded shadow">
                    <h2 className="font-bold">Compliance Warnings</h2>
                    <ul className="list-disc pl-5">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="border p-4 rounded shadow">
                    <h2 className="font-semibold text-lg border-b pb-2 mb-2">Output GST</h2>
                    <p>IGST: {summary.outputGST.igst}</p>
                    <p>CGST: {summary.outputGST.cgst}</p>
                    <p>SGST: {summary.outputGST.sgst}</p>
                    <p className="font-bold mt-2">Total Output GST: {summary.outputGST.total}</p>
                </div>
                
                <div className="border p-4 rounded shadow">
                    <h2 className="font-semibold text-lg border-b pb-2 mb-2">Net Outward Supply</h2>
                    <p>Gross Taxable Sales: {summary.netOutwardSupply.grossTaxableSales}</p>
                    <p>Credit Notes: {summary.netOutwardSupply.creditNotes}</p>
                    <p className="font-bold mt-2">Net Taxable Sales: {summary.netOutwardSupply.netTaxableSales}</p>
                </div>
            </div>
        </div>
    );
}
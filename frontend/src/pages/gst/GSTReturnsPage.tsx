import React, { useEffect, useState } from 'react';
import { gstApi } from '../../services/apiServices';

export default function GSTReturnsPage() {
    const [gstr1, setGstr1] = useState<any>(null);
    const [gstr3b, setGstr3b] = useState<any>(null);

    useEffect(() => {
        gstApi.getGSTR1().then(res => setGstr1(res.data)).catch(console.error);
        gstApi.getGSTR3B().then(res => setGstr3b(res.data)).catch(console.error);
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">GST Returns Preparation</h1>
            <div className="bg-yellow-100 text-yellow-800 p-3 mb-6 rounded">
                Preparation / Export — Not Direct Government Filing
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border p-4 rounded shadow">
                    <h2 className="text-xl font-bold border-b pb-2 mb-4">GSTR-1 Dataset</h2>
                    {gstr1 ? (
                        <div>
                            <p>B2B Invoices: {gstr1.b2b?.length || 0}</p>
                            <p>B2C Invoices: {gstr1.b2c?.length || 0}</p>
                            <p>Credit Notes: {gstr1.creditNotes?.length || 0}</p>
                            <p>HSN Summary Records: {gstr1.hsnSummary?.length || 0}</p>
                        </div>
                    ) : 'Loading...'}
                </div>
                <div className="border p-4 rounded shadow">
                    <h2 className="text-xl font-bold border-b pb-2 mb-4">GSTR-3B Summary</h2>
                    {gstr3b ? (
                        <div>
                            <p className="font-semibold">Outward Supplies</p>
                            <p>Net Taxable: {gstr3b.outwardSupplies.netTaxableSales}</p>
                            <p className="font-semibold mt-4">Net Output Tax</p>
                            <p>IGST: {gstr3b.netOutputTax.igst}</p>
                            <p>CGST: {gstr3b.netOutputTax.cgst}</p>
                            <p>SGST: {gstr3b.netOutputTax.sgst}</p>
                        </div>
                    ) : 'Loading...'}
                </div>
            </div>
        </div>
    );
}
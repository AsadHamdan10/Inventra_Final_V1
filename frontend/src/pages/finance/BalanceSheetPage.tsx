import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { PageHeader, Spinner, Badge, inr } from "../../components/ui";

export function BalanceSheetPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getBalanceSheet().then(setData).finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <PageHeader title="Balance Sheet" />
                {!loading && data && (
                    <Badge variant={data.isBalanced ? "green" : "red"}>{data.isBalanced ? "Balanced" : "Imbalanced"}</Badge>
                )}
            </div>
            {loading ? <Spinner /> : !data ? <div>Failed to load</div> : (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="bg-white dark:bg-gray-800 shadow rounded">
                        <div className="p-4 border-b font-bold">Assets</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {data.assetAccounts.map((a: any) => (
                                    <tr key={a.id}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{inr(a.balance)}</td></tr>
                                ))}
                                <tr className="font-bold border-t"><td className="px-4 py-3">Total Assets</td><td className="px-4 py-3 text-right">{inr(data.totalAssets)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 shadow rounded">
                            <div className="p-4 border-b font-bold">Liabilities</div>
                            <table className="w-full text-sm">
                                <tbody>
                                    {data.liabilityAccounts.map((a: any) => (
                                        <tr key={a.id}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{inr(a.balance)}</td></tr>
                                    ))}
                                    <tr className="font-bold border-t"><td className="px-4 py-3">Total Liabilities</td><td className="px-4 py-3 text-right">{inr(data.totalLiabilities)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 shadow rounded">
                            <div className="p-4 border-b font-bold">Equity</div>
                            <table className="w-full text-sm">
                                <tbody>
                                    {data.equityAccounts.map((a: any) => (
                                        <tr key={a.id}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{inr(a.balance)}</td></tr>
                                    ))}
                                    <tr><td className="px-4 py-2">Current Year Net Profit</td><td className="px-4 py-2 text-right">{inr(data.netProfit)}</td></tr>
                                    <tr className="font-bold border-t"><td className="px-4 py-3">Total Equity</td><td className="px-4 py-3 text-right">{inr(data.totalEquity)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

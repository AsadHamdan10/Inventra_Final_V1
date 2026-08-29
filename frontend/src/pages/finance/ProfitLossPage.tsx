import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { PageHeader, Spinner, inr } from "../../components/ui";

export function ProfitLossPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getProfitLoss().then(setData).finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-4">
            <PageHeader title="Profit and Loss" />
            {loading ? <Spinner /> : !data ? <div>Failed to load</div> : (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="bg-white dark:bg-gray-800 shadow rounded">
                        <div className="p-4 border-b font-bold">Revenue</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {data.revenueAccounts.map((a: any) => (
                                    <tr key={a.id}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{inr(a.balance)}</td></tr>
                                ))}
                                <tr className="font-bold border-t"><td className="px-4 py-3">Total Revenue</td><td className="px-4 py-3 text-right">{inr(data.totalRevenue)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-white dark:bg-gray-800 shadow rounded">
                        <div className="p-4 border-b font-bold">Expenses</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {data.expenseAccounts.map((a: any) => (
                                    <tr key={a.id}><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right">{inr(a.balance)}</td></tr>
                                ))}
                                <tr className="font-bold border-t"><td className="px-4 py-3">Total Expenses</td><td className="px-4 py-3 text-right">{inr(data.totalExpense)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="md:col-span-2">
                        <div className={`p-6 rounded font-bold text-xl flex justify-between ${data.netProfit >= 0 ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
                            <span>Net Profit / (Loss)</span>
                            <span>{inr(data.netProfit)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

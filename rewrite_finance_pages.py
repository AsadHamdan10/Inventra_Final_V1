
import os

trial_balance = """import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { PageHeader, Spinner, inr } from "../../components/ui";

export function TrialBalancePage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getTrialBalance().then(setData).finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-4">
            <PageHeader title="Trial Balance" />
            {loading ? <Spinner /> : !data ? <div>Failed to load</div> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-100 uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Account</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {data.balances.map((b: any) => (
                                <tr key={b.accountId} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                    <td className="px-4 py-3">{b.code}</td>
                                    <td className="px-4 py-3">{b.name}</td>
                                    <td className="px-4 py-3">{b.accountType}</td>
                                    <td className="px-4 py-3 text-right">{b.balanceType === "DEBIT" ? inr(b.balance) : "-"}</td>
                                    <td className="px-4 py-3 text-right">{b.balanceType === "CREDIT" ? inr(b.balance) : "-"}</td>
                                </tr>
                            ))}
                            <tr className="font-bold bg-gray-50 dark:bg-gray-900">
                                <td colSpan={3} className="px-4 py-3 text-right">Totals</td>
                                <td className="px-4 py-3 text-right">{inr(data.totalDebit)}</td>
                                <td className="px-4 py-3 text-right">{inr(data.totalCredit)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
"""

profit_loss = """import React, { useEffect, useState } from "react";
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
"""

balance_sheet = """import React, { useEffect, useState } from "react";
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
"""

with open("frontend/src/pages/finance/TrialBalancePage.tsx", "w", encoding="utf-8") as f: f.write(trial_balance)
with open("frontend/src/pages/finance/ProfitLossPage.tsx", "w", encoding="utf-8") as f: f.write(profit_loss)
with open("frontend/src/pages/finance/BalanceSheetPage.tsx", "w", encoding="utf-8") as f: f.write(balance_sheet)


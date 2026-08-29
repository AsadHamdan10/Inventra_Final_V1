import React, { useEffect, useState } from "react";
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


import os

os.makedirs("frontend/src/pages/finance", exist_ok=True)

trial_balance = """import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatCurrency } from "../../utils/formatters";
import { Loader2 } from "lucide-react";

export function TrialBalancePage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getTrialBalance().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!data) return <div>Failed to load</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
            <Card>
                <CardHeader><CardTitle>Account Balances</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.balances.map((b: any) => (
                                <TableRow key={b.accountId}>
                                    <TableCell>{b.code}</TableCell>
                                    <TableCell>{b.name}</TableCell>
                                    <TableCell>{b.accountType}</TableCell>
                                    <TableCell className="text-right">{b.balanceType === "DEBIT" ? formatCurrency(b.balance) : "-"}</TableCell>
                                    <TableCell className="text-right">{b.balanceType === "CREDIT" ? formatCurrency(b.balance) : "-"}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold">
                                <TableCell colSpan={3} className="text-right">Totals</TableCell>
                                <TableCell className="text-right">{formatCurrency(data.totalDebit)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(data.totalCredit)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
"""

profit_loss = """import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatCurrency } from "../../utils/formatters";
import { Loader2 } from "lucide-react";

export function ProfitLossPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getProfitLoss().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!data) return <div>Failed to load</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Profit & Loss</h1>
            
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.revenueAccounts.map((a: any) => (
                                    <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell>Total Revenue</TableCell><TableCell className="text-right">{formatCurrency(data.totalRevenue)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.expenseAccounts.map((a: any) => (
                                    <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell>Total Expenses</TableCell><TableCell className="text-right">{formatCurrency(data.totalExpense)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <Card className={data.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}>
                <CardContent className="p-6">
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span>Net Profit / (Loss)</span>
                        <span>{formatCurrency(data.netProfit)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
"""

balance_sheet = """import React, { useEffect, useState } from "react";
import { financialStatementApi } from "../../services/apiServices";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatCurrency } from "../../utils/formatters";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function BalanceSheetPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        financialStatementApi.getBalanceSheet().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!data) return <div>Failed to load</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Balance Sheet</h1>
                {data.isBalanced ? (
                    <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-5 h-5 mr-2" /> Balanced</div>
                ) : (
                    <div className="flex items-center text-red-600 bg-red-50 px-3 py-1 rounded-full"><XCircle className="w-5 h-5 mr-2" /> Imbalanced</div>
                )}
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.assetAccounts.map((a: any) => (
                                    <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell>Total Assets</TableCell><TableCell className="text-right">{formatCurrency(data.totalAssets)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Liabilities</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.liabilityAccounts.map((a: any) => (
                                        <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                                    ))}
                                    <TableRow className="font-bold"><TableCell>Total Liabilities</TableCell><TableCell className="text-right">{formatCurrency(data.totalLiabilities)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Equity</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.equityAccounts.map((a: any) => (
                                        <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
                                    ))}
                                    <TableRow><TableCell>Current Year Net Profit</TableCell><TableCell className="text-right">{formatCurrency(data.netProfit)}</TableCell></TableRow>
                                    <TableRow className="font-bold"><TableCell>Total Equity</TableCell><TableCell className="text-right">{formatCurrency(data.totalEquity)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
"""

with open("frontend/src/pages/finance/TrialBalancePage.tsx", "w", encoding="utf-8") as f: f.write(trial_balance)
with open("frontend/src/pages/finance/ProfitLossPage.tsx", "w", encoding="utf-8") as f: f.write(profit_loss)
with open("frontend/src/pages/finance/BalanceSheetPage.tsx", "w", encoding="utf-8") as f: f.write(balance_sheet)


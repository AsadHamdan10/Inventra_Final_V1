
import os

controllers = {
    "financialStatementController.ts": """import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { Prisma } from "@prisma/client";

export class FinancialStatementController {
    
    static async getTrialBalance(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : new Date(new Date().getFullYear(), 0, 1);
            const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

            const accounts = await prisma.chartOfAccount.findMany({ where: { userId }, orderBy: { code: "asc" } });
            
            const lines = await prisma.journalLine.groupBy({
                by: ["accountId"],
                where: { 
                    userId,
                    entry: { date: { gte: fromDate, lte: toDate }, status: "POSTED" }
                },
                _sum: { debit: true, credit: true }
            });

            const balances = accounts.map(acc => {
                const line = lines.find(l => l.accountId === acc.id);
                const debit = Number(line?._sum.debit || 0);
                const credit = Number(line?._sum.credit || 0);
                
                let balance = 0;
                let balanceType = "DEBIT";
                
                if (acc.accountType === "ASSET" || acc.accountType === "EXPENSE") {
                    balance = debit - credit;
                    balanceType = balance >= 0 ? "DEBIT" : "CREDIT";
                } else {
                    balance = credit - debit;
                    balanceType = balance >= 0 ? "CREDIT" : "DEBIT";
                }

                return {
                    accountId: acc.id,
                    code: acc.code,
                    name: acc.name,
                    accountType: acc.accountType,
                    debitTotal: debit,
                    creditTotal: credit,
                    balance: Math.abs(balance),
                    balanceType
                };
            }).filter(b => b.debitTotal > 0 || b.creditTotal > 0);

            const totalDebit = balances.reduce((sum, b) => sum + b.debitTotal, 0);
            const totalCredit = balances.reduce((sum, b) => sum + b.creditTotal, 0);

            res.json({ balances, totalDebit, totalCredit });
        } catch (e) { next(e); }
    }

    static async getProfitLoss(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : new Date(new Date().getFullYear(), 0, 1);
            const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

            const lines = await prisma.journalLine.groupBy({
                by: ["accountId"],
                where: { 
                    userId,
                    entry: { date: { gte: fromDate, lte: toDate }, status: "POSTED" }
                },
                _sum: { debit: true, credit: true }
            });

            const accounts = await prisma.chartOfAccount.findMany({ where: { userId } });
            
            let totalRevenue = 0;
            let totalExpense = 0;

            const revenueAccounts: any[] = [];
            const expenseAccounts: any[] = [];

            accounts.forEach(acc => {
                const line = lines.find(l => l.accountId === acc.id);
                if (!line) return;
                
                const debit = Number(line._sum.debit || 0);
                const credit = Number(line._sum.credit || 0);
                
                if (acc.accountType === "REVENUE") {
                    const balance = credit - debit;
                    if (balance !== 0) {
                        revenueAccounts.push({ ...acc, balance });
                        totalRevenue += balance;
                    }
                } else if (acc.accountType === "EXPENSE") {
                    const balance = debit - credit;
                    if (balance !== 0) {
                        expenseAccounts.push({ ...acc, balance });
                        totalExpense += balance;
                    }
                }
            });

            const netProfit = totalRevenue - totalExpense;

            res.json({ revenueAccounts, expenseAccounts, totalRevenue, totalExpense, netProfit });
        } catch (e) { next(e); }
    }

    static async getBalanceSheet(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            // Balance sheet usually is As Of a date, so from beginning of time up to toDate
            const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

            const lines = await prisma.journalLine.groupBy({
                by: ["accountId"],
                where: { 
                    userId,
                    entry: { date: { lte: toDate }, status: "POSTED" }
                },
                _sum: { debit: true, credit: true }
            });

            const accounts = await prisma.chartOfAccount.findMany({ where: { userId } });
            
            let totalAssets = 0;
            let totalLiabilities = 0;
            let totalEquity = 0;
            
            let totalRevenue = 0;
            let totalExpense = 0;

            const assetAccounts: any[] = [];
            const liabilityAccounts: any[] = [];
            const equityAccounts: any[] = [];

            accounts.forEach(acc => {
                const line = lines.find(l => l.accountId === acc.id);
                const debit = Number(line?._sum.debit || 0);
                const credit = Number(line?._sum.credit || 0);
                
                if (acc.accountType === "ASSET") {
                    const balance = debit - credit;
                    if (balance !== 0) {
                        assetAccounts.push({ ...acc, balance });
                        totalAssets += balance;
                    }
                } else if (acc.accountType === "LIABILITY") {
                    const balance = credit - debit;
                    if (balance !== 0) {
                        liabilityAccounts.push({ ...acc, balance });
                        totalLiabilities += balance;
                    }
                } else if (acc.accountType === "EQUITY") {
                    const balance = credit - debit;
                    if (balance !== 0) {
                        equityAccounts.push({ ...acc, balance });
                        totalEquity += balance;
                    }
                } else if (acc.accountType === "REVENUE") {
                    totalRevenue += (credit - debit);
                } else if (acc.accountType === "EXPENSE") {
                    totalExpense += (debit - credit);
                }
            });

            const netProfit = totalRevenue - totalExpense;
            
            // Add net profit to equity
            totalEquity += netProfit;

            res.json({ 
                assetAccounts, 
                liabilityAccounts, 
                equityAccounts, 
                totalAssets, 
                totalLiabilities, 
                totalEquity,
                netProfit,
                isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
            });
        } catch (e) { next(e); }
    }
}
"""
}

for name, content in controllers.items():
    with open(f"backend/src/controllers/{name}", "w", encoding="utf-8") as f:
        f.write(content)



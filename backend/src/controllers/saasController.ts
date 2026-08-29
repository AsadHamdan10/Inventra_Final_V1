
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { auditLog } from "../services/auditService";
import { Decimal } from "@prisma/client/runtime/library";

export class SaasController {
    static async listPlans(req: Request, res: Response, next: NextFunction) {
        try {
            const plans = await prisma.saaSPlan.findMany({ where: { isActive: true } });
            res.json(plans);
        } catch (e) { next(e); }
    }

    static async listSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const subs = await prisma.saaSSubscription.findMany({
                include: { user: { select: { companyName: true, email: true } }, plan: true },
                orderBy: { createdAt: "desc" }
            });
            res.json(subs);
        } catch (e) { next(e); }
    }

    static async getSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const sub = await prisma.saaSSubscription.findUnique({
                where: { id: parseInt(req.params.id) },
                include: { user: { select: { companyName: true, email: true } }, plan: true, payments: { include: { commissions: true } } }
            });
            if (!sub) return res.status(404).json({ error: "Not found" });
            res.json(sub);
        } catch (e) { next(e); }
    }

    static async createSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, planId, startDate, endDate, discountAmount, notes } = req.body;
            const plan = await prisma.saaSPlan.findUnique({ where: { id: parseInt(planId) } });
            if (!plan) return res.status(400).json({ error: "Invalid plan" });

            const listPrice = Number(plan.annualPrice);
            const disc = Number(discountAmount) || 0;
            const finalAmount = listPrice - disc;

            const sub = await prisma.saaSSubscription.create({
                data: {
                    userId: parseInt(userId),
                    planId: plan.id,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    listPrice, discountAmount: disc, finalAmount,
                    notes,
                    status: "UNPAID"
                },
                include: { plan: true, user: true }
            });

            // Fallback backward compatibility sync
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: { plan: plan.businessType, subscriptionStart: new Date(startDate), subscriptionEnd: new Date(endDate) }
            });

            await auditLog(req.user!.userId, "SAAS_SUBSCRIPTION_CREATED", `Created subscription for user ${userId}`, req);
            res.status(201).json(sub);
        } catch (e) { next(e); }
    }

    static async cancelSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const sub = await prisma.saaSSubscription.update({
                where: { id: parseInt(req.params.id) },
                data: { status: "CANCELLED" }
            });
            await auditLog(req.user!.userId, "SAAS_SUBSCRIPTION_CANCELLED", `Cancelled subscription ${sub.id}`, req);
            res.json(sub);
        } catch (e) { next(e); }
    }

    static async recordPayment(req: Request, res: Response, next: NextFunction) {
        try {
            const { amountReceived, paymentDate, paymentMethod, transactionReference, receiptNumber, notes } = req.body;
            const subId = parseInt(req.params.id);

            const sub = await prisma.saaSSubscription.findUnique({ where: { id: subId }, include: { payments: true } });
            if (!sub) return res.status(404).json({ error: "Subscription not found" });

            const totalPaid = sub.payments.reduce((acc: number, p: any) => acc + Number(p.amountReceived), 0);
            const amt = Number(amountReceived);
            const finalAmt = Number(sub.finalAmount);

            if (totalPaid + amt > finalAmt) {
                return res.status(400).json({ error: "Overpayment protection: Payment exceeds outstanding amount." });
            }

            const payment = await prisma.saaSPayment.create({
                data: {
                    subscriptionId: sub.id, userId: sub.userId,
                    amountReceived: amt, paymentDate: new Date(paymentDate),
                    paymentMethod, transactionReference, receiptNumber, notes,
                    recordedBy: req.user!.userId
                }
            });

            const newTotalPaid = totalPaid + amt;
            let status = sub.status;
            if (newTotalPaid >= finalAmt) status = "PAID";
            else if (newTotalPaid > 0) status = "PARTIALLY_PAID";

            await prisma.saaSSubscription.update({ where: { id: sub.id }, data: { status } });
            await auditLog(req.user!.userId, "SAAS_PAYMENT_RECORDED", `Recorded payment ${amt} for sub ${sub.id}`, req);
            res.status(201).json(payment);
        } catch (e) { next(e); }
    }

    static async recordCommission(req: Request, res: Response, next: NextFunction) {
        try {
            const paymentId = parseInt(req.params.paymentId);
            const { marketerName, commissionAmount, notes } = req.body;
            
            const pmt = await prisma.saaSPayment.findUnique({ where: { id: paymentId }, include: { commissions: true } });
            if (!pmt) return res.status(404).json({ error: "Payment not found" });

            const existingCommissions = pmt.commissions.reduce((acc: number, c: any) => acc + Number(c.commissionAmount), 0);
            if (existingCommissions + Number(commissionAmount) > Number(pmt.amountReceived)) {
                return res.status(400).json({ error: "Commission exceeds payment amount" });
            }

            const commission = await prisma.saaSCommission.create({
                data: { paymentId, marketerName, commissionAmount: Number(commissionAmount), notes }
            });
            await auditLog(req.user!.userId, "SAAS_COMMISSION_RECORDED", `Commission ${commissionAmount} recorded for payment ${paymentId}`, req);
            res.status(201).json(commission);
        } catch (e) { next(e); }
    }

    static async getRevenue(req: Request, res: Response, next: NextFunction) {
        try {
            // Very simple total aggregations
            const payments = await prisma.saaSPayment.aggregate({ _sum: { amountReceived: true } });
            const commissions = await prisma.saaSCommission.aggregate({ _sum: { commissionAmount: true } });
            const subs = await prisma.saaSSubscription.findMany();
            
            let outstanding = 0;
            let totalCollected = Number(payments._sum.amountReceived || 0);
            let totalCommissions = Number(commissions._sum.commissionAmount || 0);

            for (const s of subs) {
                if (s.status !== "CANCELLED" && s.status !== "EXPIRED") {
                    const subP = await prisma.saaSPayment.aggregate({ where: { subscriptionId: s.id }, _sum: { amountReceived: true } });
                    outstanding += Number(s.finalAmount) - Number(subP._sum.amountReceived || 0);
                }
            }

            res.json({
                totalCollected,
                outstanding,
                marketerCommission: totalCommissions,
                netRevenue: totalCollected - totalCommissions
            });
        } catch (e) { next(e); }
    }
}


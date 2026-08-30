import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { auditLog } from "../services/auditService";

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
                include: { user: { select: { companyName: true, email: true } }, plan: true, payments: true },
                orderBy: { createdAt: "desc" }
            });
            res.json(subs);
        } catch (e) { next(e); }
    }

    static async getSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const sub = await prisma.saaSSubscription.findUnique({
                where: { id: parseInt(req.params.id) },
                include: { user: { select: { companyName: true, email: true, plan: true } }, plan: true, payments: { include: { commissions: true } } }
            });
            if (!sub) return res.status(404).json({ error: "Not found" });
            res.json(sub);
        } catch (e) { next(e); }
    }

    static async createSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, planId, startDate, discountAmount, notes } = req.body;
            const plan = await prisma.saaSPlan.findUnique({ where: { id: parseInt(planId) } });
            if (!plan) return res.status(400).json({ error: "Invalid plan" });
            if (plan.status !== "ACTIVE") return res.status(400).json({ error: "This plan is not active and cannot be used for a new subscription." });

            // Phase 6.10H: listPrice/discountAmount/finalAmount and the commercial
            // entitlement (platformAccess/durationMonths/includedUsers) are ALWAYS
            // read from the authoritative plan row and snapshotted here. Only the
            // discretionary discount is accepted from the request body (Super
            // Admin may grant a one-off discount on top of the plan's own list
            // price); nothing else about price is ever taken from the client.
            const listPrice = Number(plan.listPrice || plan.annualPrice);
            // Defaults to the plan's own catalog discount; an explicit
            // discountAmount in the request lets Super Admin override it with a
            // one-off discretionary discount for this specific subscription.
            const disc = discountAmount !== undefined && discountAmount !== null && discountAmount !== ''
                ? Number(discountAmount) || 0
                : Number(plan.discountAmount || 0);
            const finalAmount = Math.max(0, listPrice - disc);

            const start = startDate ? new Date(startDate) : new Date();
            const end = new Date(start);
            end.setMonth(end.getMonth() + plan.durationMonths);
            end.setDate(end.getDate() - 1);

            const sub = await prisma.saaSSubscription.create({
                data: {
                    userId: parseInt(userId),
                    planId: plan.id,
                    startDate: start,
                    endDate: end,
                    listPrice, discountAmount: disc, finalAmount,
                    platformAccess: plan.platformAccess,
                    durationMonths: plan.durationMonths,
                    includedUsers: plan.includedUsers,
                    notes,
                    status: "UNPAID"
                },
                include: { plan: true, user: true }
            });

            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: { plan: plan.code, subscriptionStart: start, subscriptionEnd: end }
            });

            await auditLog(req.user!.userId, "SAAS_SUBSCRIPTION_CREATED",
                `Created subscription for user ${userId}: ${plan.code} @ ₹${finalAmount} (${plan.durationMonths}mo, ${plan.includedUsers} users, ${plan.platformAccess})`, req);
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

    static async recordExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const { expenseDate, category, amount, description, reference, notes } = req.body;
            
            const expense = await prisma.saaSExpense.create({
                data: {
                    expenseDate: new Date(expenseDate),
                    category,
                    amount: Number(amount),
                    description,
                    reference,
                    notes,
                    recordedBy: req.user!.userId
                }
            });
            await auditLog(req.user!.userId, "SAAS_EXPENSE_RECORDED", `Recorded expense ${amount} for ${category}`, req);
            res.status(201).json(expense);
        } catch (e) { next(e); }
    }

    static async listExpenses(req: Request, res: Response, next: NextFunction) {
        try {
            const expenses = await prisma.saaSExpense.findMany({
                orderBy: { expenseDate: "desc" }
            });
            res.json(expenses);
        } catch (e) { next(e); }
    }

    static async updateExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            const { expenseDate, category, amount, description, reference, notes } = req.body;
            
            const expense = await prisma.saaSExpense.update({
                where: { id },
                data: {
                    expenseDate: new Date(expenseDate),
                    category,
                    amount: Number(amount),
                    description,
                    reference,
                    notes
                }
            });
            await auditLog(req.user!.userId, "SAAS_EXPENSE_UPDATED", `Updated expense ${id} - ${category}`, req);
            res.json(expense);
        } catch (e) { next(e); }
    }

    static async deleteExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            await prisma.saaSExpense.delete({ where: { id } });
            await auditLog(req.user!.userId, "SAAS_EXPENSE_DELETED", `Deleted expense ${id}`, req);
            res.json({ message: "Expense deleted successfully" });
        } catch (e) { next(e); }
    }

    static async getRevenue(req: Request, res: Response, next: NextFunction) {
        try {
            const payments = await prisma.saaSPayment.aggregate({ _sum: { amountReceived: true } });
            const commissions = await prisma.saaSCommission.aggregate({ _sum: { commissionAmount: true } });
            const expenses = await prisma.saaSExpense.aggregate({ _sum: { amount: true } });
            
            const subs = await prisma.saaSSubscription.findMany();
            
            let outstanding = 0;
            let totalCollected = Number(payments._sum.amountReceived || 0);
            let totalCommissions = Number(commissions._sum.commissionAmount || 0);
            let totalExpenses = Number(expenses._sum.amount || 0);

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
                otherExpenses: totalExpenses,
                netPlatformIncome: totalCollected - totalCommissions - totalExpenses
            });
        } catch (e) { next(e); }
    }

    // ─── Renew Subscription ────────────────────────────────────────────────────
    // Creates a NEW subscription period using the CURRENT authoritative plan price.
    // The old subscription remains untouched (historical integrity).
    static async renewSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const subId = parseInt(req.params.id);
            const existingSub = await prisma.saaSSubscription.findUnique({
                where: { id: subId },
                include: { plan: true, user: true }
            });
            if (!existingSub) return res.status(404).json({ error: 'Subscription not found' });

            // Get the CURRENT authoritative plan price (not the snapshot from old sub)
            const currentPlan = await prisma.saaSPlan.findUnique({ where: { id: existingSub.planId } });
            if (!currentPlan || currentPlan.status !== 'ACTIVE') {
                return res.status(400).json({ error: 'Plan is no longer active. Contact administrator.' });
            }

            // New period starts from the day after the old subscription ends
            const startDate = new Date(existingSub.endDate);
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(0, 0, 0, 0);

            // Phase 6.10H: duration now comes from the CURRENT plan's own
            // durationMonths (1 year / 3 years / whatever Super Admin has
            // configured) instead of being hardcoded to exactly one year.
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + currentPlan.durationMonths);
            endDate.setDate(endDate.getDate() - 1); // e.g. 29 Aug → 28 Aug N years later

            // Bug fix: this previously ignored the plan's configured discount
            // entirely (hardcoded discountAmount: 0), so a discounted plan would
            // silently renew at full list price - inconsistent with
            // createSubscription/approveApplication, which both apply
            // listPrice - discountAmount.
            const currentListPrice = Number(currentPlan.listPrice || currentPlan.annualPrice);
            const currentDiscount = Number(currentPlan.discountAmount || 0);
            const currentFinalAmount = Math.max(0, currentListPrice - currentDiscount);

            const newSub = await prisma.saaSSubscription.create({
                data: {
                    userId: existingSub.userId,
                    planId: existingSub.planId,
                    status: 'UNPAID',
                    startDate,
                    endDate,
                    listPrice: currentListPrice,   // CURRENT authoritative price
                    discountAmount: currentDiscount,
                    finalAmount: currentFinalAmount,
                    // CURRENT authoritative entitlement - a renewal always picks up
                    // whatever the plan is configured as today, not what the old
                    // subscription snapshot happened to say.
                    platformAccess: currentPlan.platformAccess,
                    durationMonths: currentPlan.durationMonths,
                    includedUsers: currentPlan.includedUsers,
                    renewedFromSubscriptionId: existingSub.id,
                    notes: `Renewal of subscription #${subId}. Price at renewal: ₹${currentFinalAmount}`
                },
                include: { plan: true }
            });

            // Update user's subscription dates to the new period
            await prisma.user.update({
                where: { id: existingSub.userId },
                data: {
                    plan: currentPlan.code,
                    subscriptionStart: startDate,
                    subscriptionEnd: endDate
                }
            });

            await auditLog(req.user!.userId, 'SAAS_SUBSCRIPTION_RENEWED',
                `Subscription #${subId} renewed. New sub #${newSub.id}. Price: ₹${currentFinalAmount} (${currentPlan.durationMonths}mo, ${currentPlan.includedUsers} users, ${currentPlan.platformAccess})`, req);

            res.status(201).json({
                success: true,
                message: `Subscription renewed. New period: ${startDate.toDateString()} to ${endDate.toDateString()}. Price: ₹${currentFinalAmount} (UNPAID)`,
                subscription: newSub
            });
        } catch (e) { next(e); }
    }
}

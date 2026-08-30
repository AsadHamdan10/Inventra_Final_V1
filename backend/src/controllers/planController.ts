import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { auditLog } from "../services/auditService";

const PLATFORM_VALUES = ["MOBILE", "DESKTOP", "DESKTOP_MOBILE"];
const STATUS_VALUES = ["ACTIVE", "INACTIVE", "ARCHIVED"];

function toNumber(v: any, fallback = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// Recomputes finalPrice from listPrice/discountAmount and keeps the legacy
// annualPrice + isActive columns in sync so existing call sites (registration,
// createSubscription, renewSubscription, listPlans's `where: { isActive }`
// filter) keep working unchanged while the new fields become authoritative.
function normalizePlanInput(body: any) {
    const listPrice = toNumber(body.listPrice);
    const discountAmount = toNumber(body.discountAmount, 0);
    const finalPrice = Math.max(0, +(listPrice - discountAmount).toFixed(2));
    const status = STATUS_VALUES.includes(body.status) ? body.status : "ACTIVE";
    const platformAccess = PLATFORM_VALUES.includes(body.platformAccess) ? body.platformAccess : "DESKTOP";

    return {
        code: body.code,
        name: body.name,
        displayName: body.displayName || body.name,
        description: body.description || null,
        businessType: body.businessType === "BOTH" ? "BOTH" : "TRADING",
        platformAccess,
        durationMonths: toNumber(body.durationMonths, 12) || 12,
        includedUsers: toNumber(body.includedUsers, 5) || 5,
        currency: body.currency || "INR",
        listPrice,
        discountAmount,
        finalPrice,
        annualPrice: finalPrice, // legacy column - kept authoritative-equivalent
        status,
        isActive: status === "ACTIVE",
    };
}

export class PlanController {
    // ── Super Admin: full catalog (including inactive/archived) ──────────
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const plans = await prisma.saaSPlan.findMany({ orderBy: [{ businessType: "asc" }, { finalPrice: "asc" }] });
            res.json(plans);
        } catch (e) { next(e); }
    }

    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const plan = await prisma.saaSPlan.findUnique({ where: { id: parseInt(req.params.id) } });
            if (!plan) return res.status(404).json({ error: "Plan not found" });
            res.json(plan);
        } catch (e) { next(e); }
    }

    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const data = normalizePlanInput(req.body);
            if (!data.code || !data.name) return res.status(400).json({ error: "code and name are required." });
            const plan = await prisma.saaSPlan.create({ data });
            await auditLog(req.user!.userId, "SAAS_PLAN_CREATED", `Created plan ${plan.code} (${plan.name}) @ ₹${plan.finalPrice}`, req);
            res.status(201).json(plan);
        } catch (e: any) {
            if (e.code === "P2002") return res.status(409).json({ error: "A plan with this code already exists." });
            next(e);
        }
    }

    // Editing an existing plan NEVER touches any SaaSSubscription row - every
    // subscription snapshots listPrice/discountAmount/finalAmount/platformAccess/
    // durationMonths/includedUsers at creation time and is never re-read from
    // the live plan afterward. This edit only changes what a FUTURE
    // registration/subscription will see.
    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id);
            const existing = await prisma.saaSPlan.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: "Plan not found" });
            if (existing.status === "ARCHIVED") {
                return res.status(400).json({ error: "Archived plans cannot be edited. Duplicate it into a new plan instead." });
            }

            const before = { ...existing };
            const data = normalizePlanInput({ ...existing, ...req.body });
            const plan = await prisma.saaSPlan.update({ where: { id }, data });

            const changedFields = Object.keys(data).filter(k => String((before as any)[k]) !== String((data as any)[k]));
            await auditLog(req.user!.userId, "SAAS_PLAN_UPDATED",
                `Updated plan ${plan.code}. Changed: ${changedFields.join(", ") || "(no field changes)"}`, req);
            res.json(plan);
        } catch (e) { next(e); }
    }

    static async setStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;
            if (!STATUS_VALUES.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUS_VALUES.join(", ")}` });

            const existing = await prisma.saaSPlan.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: "Plan not found" });

            const plan = await prisma.saaSPlan.update({
                where: { id },
                data: { status, isActive: status === "ACTIVE" },
            });
            await auditLog(req.user!.userId, "SAAS_PLAN_STATUS_CHANGED", `Plan ${plan.code}: ${existing.status} -> ${status}`, req);
            res.json(plan);
        } catch (e) { next(e); }
    }

    // Duplicate lets Super Admin create a new priced offering starting from an
    // existing (possibly archived) plan's configuration, without ever mutating
    // the original - archived plans stay immutable for historical subscriptions.
    static async duplicate(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id);
            const source = await prisma.saaSPlan.findUnique({ where: { id } });
            if (!source) return res.status(404).json({ error: "Plan not found" });

            const newCode = req.body.code || `${source.code}_COPY_${Date.now()}`;
            const data = normalizePlanInput({ ...source, ...req.body, code: newCode, status: "INACTIVE" });
            const plan = await prisma.saaSPlan.create({ data });
            await auditLog(req.user!.userId, "SAAS_PLAN_DUPLICATED", `Duplicated plan ${source.code} -> ${plan.code}`, req);
            res.status(201).json(plan);
        } catch (e: any) {
            if (e.code === "P2002") return res.status(409).json({ error: "A plan with this code already exists." });
            next(e);
        }
    }

    // ── Public: only what a website/registration flow should ever see ────
    // No auth required. Never exposes archived/inactive plans, cost basis, or
    // anything beyond what's needed to present and select a commercial offering.
    static async listPublic(req: Request, res: Response, next: NextFunction) {
        try {
            const businessType = req.query.businessType === "BOTH" ? "BOTH" : req.query.businessType === "TRADING" ? "TRADING" : undefined;
            const plans = await prisma.saaSPlan.findMany({
                where: { status: "ACTIVE", ...(businessType ? { businessType } : {}) },
                orderBy: { finalPrice: "asc" },
                select: {
                    id: true, code: true, name: true, displayName: true, description: true,
                    businessType: true, platformAccess: true, durationMonths: true, includedUsers: true,
                    currency: true, listPrice: true, discountAmount: true, finalPrice: true,
                },
            });
            res.json(plans);
        } catch (e) { next(e); }
    }
}

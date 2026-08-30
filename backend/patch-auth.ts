import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { verifyRefreshToken, blindIndex, encryptIfPresent } from '../utils/security';
import { auditLog } from '../utils/logger';

// Re-use existing controller code, just replacing register/registerSchema
const fs = require('fs');
const code = fs.readFileSync('backend/src/controllers/authController.ts', 'utf8');

// Replace registerSchema
const newRegisterSchema = `
const registerSchema = z.object({
  fullName: z.string().optional(),
  companyName: z.string().min(3, "Company Name must be at least 3 characters.").max(200),
  username: z.string().min(3, "Username must be at least 3 characters.").max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must contain only letters, numbers, and underscores."),
  email: z.string().email("Invalid email address.").max(150),
  mobile: z.string().regex(/^[6-9]\\d{9}$/, "Mobile must be a valid 10-digit Indian mobile number."),
  businessType: z.enum(["TRADING", "BOTH"]),
  industry: z.string().optional().default(""),
});
`;

let updatedCode = code.replace(/const registerSchema = z\.object\(\{[\s\S]*?\}\);/, newRegisterSchema.trim());

// Replace register function
const newRegisterFn = `
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(errors)[0];
      const firstMsg   = (errors as any)[firstField]?.[0] || "Validation failed.";
      return res.status(400).json({ success: false, field: firstField, message: firstMsg });
    }

    const d = parsed.data;

    // Phase 6.10F: Backend is authoritative for plan based on businessType
    let assignedPlan = "TRADING_ANNUAL";
    if (d.businessType === "TRADING") {
      assignedPlan = "TRADING_ANNUAL";
    } else if (d.businessType === "BOTH") {
      assignedPlan = "TRADING_MANUFACTURING_ANNUAL";
    } else {
      return res.status(400).json({ success: false, message: "Invalid business type selected." });
    }

    // Check uniqueness (Username, Email, Mobile, CompanyName)
    const prisma = new (require('@prisma/client').PrismaClient)();
    const byUsername = await prisma.user.findUnique({ where: { username: d.username } });
    if (byUsername) return res.status(409).json({ success: false, field: "username", message: "Username is already taken." });

    const byEmail = await prisma.user.findFirst({ where: { email: d.email } });
    if (byEmail) return res.status(409).json({ success: false, field: "email", message: "Email is already registered." });

    const blindIndexFn = require('../utils/security').blindIndex;
    const byMobile = await prisma.user.findFirst({ where: { mobileHash: blindIndexFn(d.mobile) } });
    if (byMobile) return res.status(409).json({ success: false, field: "mobile", message: "Mobile number is already registered." });

    const byCompanyName = await prisma.user.findFirst({ where: { companyName: d.companyName } });
    if (byCompanyName) return res.status(409).json({ success: false, field: "companyName", message: "Company is already registered." });

    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const applicationRef = \`INV-2026-\${randomStr}\`;
    
    const encryptFn = require('../utils/security').encryptIfPresent;

    const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptFn(d.mobile),
        mobileHash:      blindIndexFn(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            assignedPlan, // Strictly assigned by backend
        applicationSnapshot: {
          create: {
            applicationRef,
            fullName: d.fullName || "",
            companyName: d.companyName,
            username: d.username,
            email: d.email,
            mobile: d.mobile,
            businessType: d.businessType,
            industry: d.industry || "",
            plan: assignedPlan, // Strictly assigned by backend
            billingCycle: "YEARLY",
            originalStatus: "pending"
          }
        }
      }
    });

    const auditLogFn = require('../utils/logger').auditLog;
    await auditLogFn(user.id, "USER_REGISTERED", \`Application \${applicationRef} submitted\`, req);
    
    const { sendRegistrationConfirmation, sendSuperAdminNotification } = require("../services/emailService");
    await sendRegistrationConfirmation(d.email, d.companyName, applicationRef);
    await sendSuperAdminNotification(d.companyName, d.username, d.email, d.mobile, applicationRef);

    res.json({ success: true, message: "Registration received.", applicationRef });
  } catch (err: any) {
    if (err.code === "P2002") {
      const rawField = err.meta?.target?.[0] || "field";
      return res.status(409).json({ success: false, field: rawField, message: \`\${rawField} already exists.\` });
    }
    next(err);
  }
}
`;

updatedCode = updatedCode.replace(/export async function register\([\s\S]*?\}\s*catch\s*\(err:\s*any\)\s*\{[\s\S]*?next\(err\);\s*\}\s*\}/, newRegisterFn.trim());

fs.writeFileSync('backend/src/controllers/authController.ts', updatedCode);
console.log("Updated authController.ts");

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { auditLog } from '../services/auditService';
import { assertTenantOwnership } from '../middlewares/auth';

const schema = z.object({
  materialName: z.string().min(1).max(200),
  hsnCode: z.string().optional(),
  unit: z.string().default('Nos'),
});

export const listMaterials: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const rows = await prisma.material.findMany({ where: { userId }, orderBy: { materialName: 'asc' } });
    res.json(rows);
  } catch (err) { next(err); }
}

export const createMaterial: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });
    const row = await prisma.material.create({ data: { userId, ...parsed.data } });
    await auditLog(userId, 'data_create', `Material: ${parsed.data.materialName}`, req);
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export const updateMaterial: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const owned = await assertTenantOwnership(userId, 'materials', id);
    if (!owned) return res.status(403).json({ error: 'Access denied.' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });
    const row = await prisma.material.update({ where: { id }, data: parsed.data });
    res.json(row);
  } catch (err) { next(err); }
}

export const deleteMaterial: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const owned = await assertTenantOwnership(userId, 'materials', id);
    if (!owned) return res.status(403).json({ error: 'Access denied.' });
    await prisma.material.delete({ where: { id } });
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

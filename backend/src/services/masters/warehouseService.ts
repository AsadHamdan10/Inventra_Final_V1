import prisma from '../../utils/prisma';
import { WarehouseType } from '@prisma/client';

export const getOrCreateDefaultWarehouse = async (userId: number) => {
    let defaultWarehouse = await prisma.warehouse.findFirst({
        where: { userId, code: 'MAIN' }
    });

    if (!defaultWarehouse) {
        defaultWarehouse = await prisma.warehouse.create({
            data: {
                userId,
                code: 'MAIN',
                name: 'Main Warehouse',
                warehouseType: 'GENERAL',
                isActive: true
            }
        });
    }

    // Set it as default in tenant config
    const config = await prisma.tenantConfiguration.findUnique({ where: { userId } });
    if (config && !config.defaultWarehouseId) {
        await prisma.tenantConfiguration.update({
            where: { userId },
            data: { defaultWarehouseId: defaultWarehouse.id }
        });
    }

    return defaultWarehouse;
};

export const createWarehouse = async (userId: number, data: any) => {
    // Ensure code is unique
    const existing = await prisma.warehouse.findUnique({
        where: { userId_code: { userId, code: data.code } }
    });
    if (existing) {
        throw new Error('Warehouse code already exists');
    }

    return prisma.warehouse.create({
        data: {
            userId,
            ...data
        }
    });
};

export const updateWarehouse = async (userId: number, id: number, data: any) => {
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
        throw new Error('Warehouse not found');
    }

    if (data.code && data.code !== existing.code) {
        const checkCode = await prisma.warehouse.findUnique({
            where: { userId_code: { userId, code: data.code } }
        });
        if (checkCode) throw new Error('Warehouse code already exists');
    }

    return prisma.warehouse.update({
        where: { id },
        data
    });
};

export const listWarehouses = async (userId: number) => {
    return prisma.warehouse.findMany({
        where: { userId },
        orderBy: { code: 'asc' }
    });
};

export const deactivateWarehouse = async (userId: number, id: number) => {
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Warehouse not found');

    return prisma.warehouse.update({
        where: { id },
        data: { isActive: false }
    });
};

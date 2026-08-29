import prisma from '../../utils/prisma';
import { ItemType } from '@prisma/client';

export const createItem = async (userId: number, data: any) => {
    // Unique check
    if (data.itemCode) {
        const existing = await prisma.material.findUnique({
            where: { userId_itemCode: { userId, itemCode: data.itemCode } }
        });
        if (existing) throw new Error('Item code already exists');
    }

    validateItemTypeRules(data);

    return prisma.material.create({
        data: {
            userId,
            ...data
        }
    });
};

export const updateItem = async (userId: number, id: number, data: any) => {
    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Item not found');

    if (data.itemCode && data.itemCode !== existing.itemCode) {
        const check = await prisma.material.findUnique({
            where: { userId_itemCode: { userId, itemCode: data.itemCode } }
        });
        if (check) throw new Error('Item code already exists');
    }

    const merged = { ...existing, ...data };
    validateItemTypeRules(merged);

    return prisma.material.update({
        where: { id },
        data
    });
};

export const listItems = async (userId: number, query: any = {}) => {
    return prisma.material.findMany({
        where: { userId, ...query },
        orderBy: { materialName: 'asc' }
    });
};

export const deactivateItem = async (userId: number, id: number) => {
    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Item not found');

    return prisma.material.update({
        where: { id },
        data: { isActive: false }
    });
};

function validateItemTypeRules(item: any) {
    if (item.itemType === 'SERVICE') {
        if (item.inventoryTracked === true) {
            // we allow flexibility, but log warning or enforce it
            // throw new Error('Services usually cannot be inventory tracked');
        }
    } else if (item.itemType === 'RAW_MATERIAL') {
        if (!item.purchaseEnabled) throw new Error('RAW_MATERIAL must be purchasable');
    } else if (item.itemType === 'FINISHED_GOOD') {
        if (!item.salesEnabled) throw new Error('FINISHED_GOOD must be salable');
    }
}

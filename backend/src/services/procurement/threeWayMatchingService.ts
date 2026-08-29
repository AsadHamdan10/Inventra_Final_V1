import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export const analyzeThreeWayMatch = async (userId: number, purchaseId: number) => {
    const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: {
            items: true,
            grnLinks: {
                include: {
                    goodsReceipt: {
                        include: {
                            items: true,
                            purchaseOrder: {
                                include: { items: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!purchase || purchase.userId !== userId) throw new Error('Purchase not found');
    
    if (purchase.grnLinks.length === 0) {
        return { status: 'NO_GRN', variances: [] };
    }

    const variances = [];
    let hasVariance = false;

    // We can group quantities and compare
    // This is a basic aggregate matching logic
    const poItemsMap: Record<number, any> = {};
    const grnItemsMap: Record<number, any> = {};
    const invoiceItemsMap: Record<number, any> = {};

    purchase.items.forEach(item => {
        if (item.materialId) {
            if (!invoiceItemsMap[item.materialId]) invoiceItemsMap[item.materialId] = { qty: new Decimal(0), rate: new Decimal(0) };
            invoiceItemsMap[item.materialId].qty = invoiceItemsMap[item.materialId].qty.plus(new Decimal(item.quantity));
            invoiceItemsMap[item.materialId].rate = new Decimal(item.purchaseRate || 0);
        }
    });

    purchase.grnLinks.forEach(link => {
        link.goodsReceipt.items.forEach(item => {
            if (item.materialId) {
                if (!grnItemsMap[item.materialId]) grnItemsMap[item.materialId] = { qty: new Decimal(0) };
                grnItemsMap[item.materialId].qty = grnItemsMap[item.materialId].qty.plus(new Decimal(item.acceptedQty));
            }
        });

        if (link.goodsReceipt.purchaseOrder) {
            link.goodsReceipt.purchaseOrder.items.forEach(item => {
                if (item.materialId) {
                    if (!poItemsMap[item.materialId]) poItemsMap[item.materialId] = { qty: new Decimal(0), rate: new Decimal(0) };
                    poItemsMap[item.materialId].qty = poItemsMap[item.materialId].qty.plus(new Decimal(item.orderedQty));
                    poItemsMap[item.materialId].rate = new Decimal(item.rate);
                }
            });
        }
    });

    for (const materialIdStr of Object.keys(invoiceItemsMap)) {
        const materialId = parseInt(materialIdStr);
        const inv = invoiceItemsMap[materialId];
        const grn = grnItemsMap[materialId] || { qty: new Decimal(0) };
        const po = poItemsMap[materialId] || { qty: new Decimal(0), rate: new Decimal(0) };

        if (!inv.qty.equals(grn.qty)) {
            variances.push({ type: 'QUANTITY_VARIANCE', materialId, expected: grn.qty.toNumber(), actual: inv.qty.toNumber() });
            hasVariance = true;
        }

        if (po.qty.greaterThan(0) && !inv.rate.equals(po.rate)) {
            variances.push({ type: 'RATE_VARIANCE', materialId, expected: po.rate.toNumber(), actual: inv.rate.toNumber() });
            hasVariance = true;
        }
    }

    return {
        status: hasVariance ? 'VARIANCE_DETECTED' : 'MATCHED',
        variances
    };
};

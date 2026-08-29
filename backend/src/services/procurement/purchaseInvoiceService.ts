import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';
import { postPurchaseAccounting } from '../accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../financialPeriodService';
import { encryptIfPresent } from '../../utils/crypto';
import { encryptFinancialData } from '../../utils/financialCrypto';

// Creates a Purchase Invoice directly from one or more GRNs
export const createPurchaseFromGRNs = async (userId: number, grnIds: number[], vendorId: number, vendorName: string, data: any) => {
    return prisma.$transaction(async (tx) => {
        // Fetch GRNs
        const grns = await tx.goodsReceipt.findMany({
            where: { id: { in: grnIds }, userId, status: 'POSTED' },
            include: { items: true }
        });

        if (grns.length === 0) throw new Error('No valid POSTED GRNs found');

        const billNo = data.billNo || await generateDocumentNumber('BILL', userId, data.billDate);

        // Map items from GRNs
        const itemsToCreate: any[] = [];
        let totalTaxable = 0;
        let totalGst = 0;
        let grandTotal = 0;

        for (const grn of grns) {
            for (const item of grn.items) {
                if (Number(item.acceptedQty) > 0) {
                    // For Phase 5.2, we assume rate comes from PO if available, else from input data
                    let rate = 0;
                    let gstPercent = 0;

                    if (item.purchaseOrderItemId) {
                        const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.purchaseOrderItemId }});
                        if (poItem) {
                            rate = Number(poItem.rate);
                            gstPercent = Number(poItem.gstPercent);
                        }
                    }

                    const taxable = Number(item.acceptedQty) * rate;
                    const gstAmount = taxable * (gstPercent / 100);
                    const itemTotal = taxable + gstAmount;

                    itemsToCreate.push({
                        materialId: item.materialId,
                        materialName: item.materialName,
                        quantity: item.acceptedQty,
                        purchaseRate: rate,
                        purchaseRateEnc: encryptFinancialData(rate),
                        gstPercent,
                        taxableAmount: taxable,
                        gstAmount,
                        itemTotal
                    });

                    totalTaxable += taxable;
                    totalGst += gstAmount;
                    grandTotal += itemTotal;
                }
            }
        }

        const purchase = await tx.purchase.create({
            data: {
                userId,
                billNo,
                billDate: new Date(data.billDate),
                vendorId,
                vendorName,
                vendorGstin: encryptIfPresent(data.vendorGstin),
                totalTaxable,
                totalGst,
                cgstAmount: totalGst / 2,
                sgstAmount: totalGst / 2,
                grandTotal,
                notes: `Auto-generated from GRNs`,
                items: { create: itemsToCreate },
                grnLinks: {
                    create: grns.map(g => ({ goodsReceiptId: g.id }))
                }
            },
            include: { items: true, payablePayments: true }
        });

        // Trigger Accounting
        await assertFinancialPeriodOpen(userId, purchase.billDate, tx);
        await postPurchaseAccounting(userId, purchase, userId, tx);

        return purchase;
    });
};

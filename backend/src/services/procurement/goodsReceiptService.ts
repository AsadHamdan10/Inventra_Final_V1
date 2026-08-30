
import prisma from "../../utils/prisma";
import { generateDocumentNumber } from "../../utils/tenantId";
import { assertFinancialPeriodOpen } from "../financialPeriodService";
import { encryptFinancialData } from "../../utils/financialCrypto";
import { Decimal } from "@prisma/client/runtime/library";

export const createGoodsReceipt = async (userId: number, data: any) => {
    const grnDate = data.grnDate || data.receiptDate || new Date();
    const grnNo = await generateDocumentNumber("GRN", userId, grnDate);

    // If PO is linked, validate warehouses
    if (data.purchaseOrderId) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: data.purchaseOrderId }
        });
        if (!po || po.userId !== userId) throw new Error("Purchase Order not found");
        if (po.status === "FULLY_RECEIVED" || po.status === "CLOSED") {
            throw new Error("Purchase Order is already fully received or closed");
        }
    }

    // Lookup vendor name if missing
    let vendorName = data.vendorName;
    if (!vendorName && data.vendorId) {
        // SECURITY: data.vendorId is client-supplied and must be tenant-scoped.
        const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
        if (!vendor || vendor.userId !== userId) throw new Error("Vendor not found");
        vendorName = vendor.vendorName;
    }

    // Lookup material names for items
    const processedItems = [];
    for (const item of data.items) {
        let materialName = item.materialName;
        if (item.materialId) {
            // SECURITY: item.materialId is client-supplied and must be tenant-scoped,
            // regardless of whether materialName was also supplied — otherwise this
            // GRN silently links to (and, on posting, mutates the stock of) another
            // tenant's material.
            const mat = await prisma.material.findUnique({ where: { id: item.materialId } });
            if (!mat || mat.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
            if (!materialName) materialName = mat.materialName;
        }
        processedItems.push({
            materialId: item.materialId,
            materialName: materialName,
            orderedQty: item.orderedQty || 0,
            receivedQty: item.receivedQty,
            acceptedQty: item.acceptedQty !== undefined ? item.acceptedQty : item.receivedQty,
            rejectedQty: item.rejectedQty || 0,
            unit: item.unit || "NOS",
            warehouseId: item.warehouseId || data.warehouseId,
            purchaseOrderItemId: item.purchaseOrderItemId
        });
    }

    return prisma.goodsReceipt.create({
        data: {
            userId,
            grnNo,
            grnDate: new Date(grnDate),
            vendorId: data.vendorId,
            vendorName: vendorName,
            warehouseId: data.warehouseId,
            purchaseOrderId: data.purchaseOrderId,
            deliveryChallanNo: data.deliveryChallanNo,
            transporter: data.transporter,
            vehicleNo: data.vehicleNo,
            remarks: data.remarks,
            status: "DRAFT",
            items: {
                create: processedItems
            }
        },
        include: { items: true }
    });
};

export const postGoodsReceipt = async (userId: number, id: number) => {
    return prisma.$transaction(async (tx) => {
        const grn = await tx.goodsReceipt.findUnique({
            where: { id },
            include: { items: true, purchaseOrder: { include: { items: true } } }
        });

        if (!grn || grn.userId !== userId) throw new Error("GRN not found");
        if (grn.status !== "DRAFT") throw new Error("Only DRAFT GRN can be posted");

        await assertFinancialPeriodOpen(userId, grn.grnDate, tx);

        const updatedGrn = await tx.goodsReceipt.update({
            where: { id },
            data: { status: "POSTED" }
        });

        let allPoItemsFullyReceived = true;

        for (const item of grn.items) {
            if (Number(item.acceptedQty) + Number(item.rejectedQty) !== Number(item.receivedQty)) {
                throw new Error(`Accepted + Rejected must equal Received for item ${item.materialId}`);
            }

            if (Number(item.acceptedQty) <= 0) continue;

            const targetWarehouseId = item.warehouseId || grn.warehouseId;
            if (!targetWarehouseId) throw new Error("Warehouse ID is required for stock movement");

            let unitCost = new Decimal(0);
            if (item.purchaseOrderItemId && grn.purchaseOrder) {
                const poItem = grn.purchaseOrder.items.find((poi: any) => poi.id === item.purchaseOrderItemId);
                if (poItem) {
                    unitCost = new Decimal(poItem.rate);
                    
                    const newReceived = new Decimal(poItem.receivedQty).plus(new Decimal(item.acceptedQty));
                    const newPending = new Decimal(poItem.orderedQty).minus(newReceived);
                    
                    if (newPending.lessThan(0)) {
                        throw new Error(`Received quantity exceeds PO pending quantity for item ${poItem.materialName}`);
                    }

                    await tx.purchaseOrderItem.update({
                        where: { id: poItem.id },
                        data: {
                            receivedQty: newReceived,
                            pendingQty: newPending
                        }
                    });

                    if (newPending.greaterThan(0)) allPoItemsFullyReceived = false;
                }
            } else {
                if (item.materialId) {
                    const mat = await tx.material.findUnique({ where: { id: item.materialId } });
                    if (!mat || mat.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
                    if (mat.standardCost) unitCost = new Decimal(mat.standardCost);
                }
            }

            if (item.materialId) {
                // SECURITY: guard against a materialId that belongs to another tenant
                // reaching this stock-mutating update (defense in depth in case the
                // GRN was ever created without the ownership check in createGoodsReceipt).
                const ownedMaterial = await tx.material.findUnique({ where: { id: item.materialId }, select: { userId: true } });
                if (!ownedMaterial || ownedMaterial.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
                await tx.material.update({
                    where: { id: item.materialId },
                    data: { currentStock: { increment: item.acceptedQty } }
                });

                await tx.inventoryLedger.create({
                    data: {
                        userId,
                        materialId: item.materialId,
                        warehouseId: targetWarehouseId,
                        txnDate: grn.grnDate,
                        movementType: "IN",
                        quantity: item.acceptedQty,
                        referenceType: "GOODS_RECEIPT",
                        referenceId: grn.id,
                    }
                });

                await tx.inventoryLayer.create({
                    data: {
                        userId,
                        materialId: item.materialId,
                        warehouseId: targetWarehouseId,
                        sourceType: "GOODS_RECEIPT",
                        sourceId: grn.id,
                        receivedDate: grn.grnDate,
                        originalQty: item.acceptedQty,
                        remainingQty: item.acceptedQty,
                        unitCostEnc: encryptFinancialData(unitCost.toNumber())
                    }
                });
            }
        }

        if (grn.purchaseOrderId) {
            const currentPo = await tx.purchaseOrder.findUnique({
                where: { id: grn.purchaseOrderId },
                include: { items: true }
            });
            if (currentPo) {
                const isFullyReceived = currentPo.items.every((poi: any) => new Decimal(poi.pendingQty).lte(0));
                await tx.purchaseOrder.update({
                    where: { id: currentPo.id },
                    data: { status: isFullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" }
                });
            }
        }

        return updatedGrn;
    });
};


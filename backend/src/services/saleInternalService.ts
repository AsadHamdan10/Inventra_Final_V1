
import { postSaleAccounting } from "../services/accounting/accountingIntegrationService";
import { safeDecrypt, encryptIfPresent } from "../utils/crypto";
import { encryptFinancialData } from "../utils/financialCrypto";
import { generateDocumentNumber } from "../utils/tenantId";
import { calculateGstBreakdown } from "../controllers/saleController";
import { determineInterStateByGstin } from "../utils/gstStateUtil";
function toTextOrNull(v: any) { return v ? String(v).trim() : null; }
function toDateOrNull(v: any) { return v ? new Date(v) : null; }

function buildGstExtrasData(d: any) {
  return {
    referenceNo: toTextOrNull(d.referenceNo),
    referenceDate: toDateOrNull(d.referenceDate),
    deliveryNote: toTextOrNull(d.deliveryNote),
    buyerOrderNo: toTextOrNull(d.buyerOrderNo),
    buyerOrderDate: toDateOrNull(d.buyerOrderDate),
    dispatchDocNo: toTextOrNull(d.dispatchDocNo),
    deliveryNoteDate: toDateOrNull(d.deliveryNoteDate),
    modeOfPayment: toTextOrNull(d.modeOfPayment),
    otherReference: toTextOrNull(d.otherReference),
    transportName: toTextOrNull(d.transportName),
    lrNumber: toTextOrNull(d.lrNumber),
    destination: toTextOrNull(d.destination),
    vehicleNumber: toTextOrNull(d.vehicleNumber),
    ewayBillNo: toTextOrNull(d.ewayBillNo),
    termsOfDelivery: toTextOrNull(d.termsOfDelivery),
    shipCompanyName: toTextOrNull(d.shipCompanyName),
    shipAddressLine1: encryptIfPresent(d.shipAddressLine1),
    shipAddressLine2: encryptIfPresent(d.shipAddressLine2),
    shipCity: toTextOrNull(d.shipCity),
    shipState: toTextOrNull(d.shipState),
    shipPincode: toTextOrNull(d.shipPincode),
    shipGstin: encryptIfPresent(d.shipGstin?.toUpperCase()),
    shipContactPerson: toTextOrNull(d.shipContactPerson),
    shipMobile: toTextOrNull(d.shipMobile),
    useBuyerAsShipping: Boolean(d.useBuyerAsShipping),
  };
}

export async function createSaleInternal(userId: number, data: any, tx: any): Promise<any> {
  const { customerId, invoiceDate: invoiceDateStr, items } = data;
  
  const customerObj = await tx.customer.findUnique({ where: { id: customerId } });
  const companyObj = await tx.user.findUnique({ where: { id: userId } });
  // GST FIX: previously compared companyObj.state to a nonexistent
  // customerObj.state field (Customer has no `state` column), which meant
  // this ALWAYS fell through to trusting the client-supplied `data.shipState`
  // with no backend verification. Now derived authoritatively from GST State
  // Codes (see utils/gstStateUtil.ts) — never from client input.
  const isInterState = determineInterStateByGstin(
    safeDecrypt(companyObj?.gstin) || null,
    companyObj?.state || null,
    safeDecrypt(customerObj?.gstin) || null,
    null
  );
  // SECURITY: customerId is client-supplied. Without this check, a tenant
  // could attach another tenant's customer record to their own sale,
  // exposing that customer's decrypted name/GSTIN/address in the response.
  if (!customerObj || customerObj.userId !== userId) throw new Error("Customer not found.");

  let invNo = data.invoiceNo;
  if (!invNo || invNo.trim() === "") {
    invNo = await generateDocumentNumber("INV", userId, invoiceDateStr || new Date().toISOString(), tx);
  }

  let totalTaxable = 0;
  let totalGst = 0;
  let totalPurchaseCost = 0;
  let igstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;

  const processedItems = [];
  const layerConsumptionsToCreate = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    await tx.$executeRaw`SELECT id FROM materials WHERE id = ${item.materialId} FOR UPDATE`;
    const material = await tx.material.findUnique({ where: { id: item.materialId } });
    // SECURITY: materialId is client-supplied. Without this check, a tenant
    // could reference another tenant's material and this function would
    // check/decrement THEIR stock, consume THEIR FIFO inventory layers, and
    // read THEIR cost data to compute this tenant's profit margin.
    if (!material || material.userId !== userId) throw new Error(`Material ${item.materialId} not found.`);
    
    // Only check stock and consume layers if inventoryTracked
    const isTracked = material.inventoryTracked;
    const qty = Number(item.quantity);
    
    if (isTracked && Number(material.currentStock) < qty) {
      throw new Error(`Insufficient stock for material ${material.materialName}`);
    }

    const unitPrice = Number(item.unitPrice);
    const gstPercent = Number(item.gstPercent || material.gstRate || 0);

    const taxableAmount = qty * unitPrice;
    const gstAmount = taxableAmount * (gstPercent / 100);
    const itemTotal = taxableAmount + gstAmount;

    totalTaxable += taxableAmount;
    totalGst += gstAmount;
    
    // Simplistic CGST/SGST split for now, wait... interState check?
    const breakdown = calculateGstBreakdown(taxableAmount, gstPercent, isInterState);
    igstAmount += breakdown.igst;
    cgstAmount += breakdown.cgst;
    sgstAmount += breakdown.sgst;

    let itemPurchaseCost = 0;
    
    if (isTracked) {
      let remainingToConsume = qty;
      const whereClause: any = { userId, materialId: item.materialId, remainingQty: { gt: 0 } };
      if (item.warehouseId) whereClause.warehouseId = item.warehouseId;
      
      const layers = await tx.inventoryLayer.findMany({
        where: whereClause,
        orderBy: { receivedDate: "asc" }
      });

      for (const layer of layers) {
        if (remainingToConsume <= 0) break;
        const consumeQty = Math.min(Number(layer.remainingQty), remainingToConsume);
        const costPerUnit = Number(require("../utils/financialCrypto").decryptFinancialData(layer.unitCostEnc));
        itemPurchaseCost += consumeQty * costPerUnit;
        
        layerConsumptionsToCreate.push({
          itemIndex: i,
          layerId: layer.id,
          quantityConsumed: consumeQty,
          unitCostEnc: layer.unitCostEnc
        });
        
        await tx.inventoryLayer.update({
          where: { id: layer.id },
          data: { remainingQty: Number(layer.remainingQty) - consumeQty }
        });
        remainingToConsume -= consumeQty;
      }
      
      if (remainingToConsume > 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }
      
      await tx.material.update({
        where: { id: item.materialId },
        data: { currentStock: { decrement: qty } }
      });
    }

    totalPurchaseCost += itemPurchaseCost;

    processedItems.push({
      materialId: item.materialId,
      materialName: material.materialName,
      quantity: qty,
      unitPrice: unitPrice,
      gstPercent: gstPercent,
      taxableAmount: taxableAmount,
      gstAmount: gstAmount,
      itemTotal: itemTotal,
      purchasePriceEnc: encryptFinancialData(qty > 0 ? (itemPurchaseCost / qty) : 0),
      itemProfitEnc: encryptFinancialData(taxableAmount - itemPurchaseCost)
    });
  }

  const grandTotal = totalTaxable + totalGst + Number(data.otherExpense || 0) - Number(data.roundOff || 0);
  const grossProfit = totalTaxable - totalPurchaseCost;
  
  const sale = await tx.sale.create({
    data: {
      userId,
      customerId,
      companyName: customerObj.companyName, // Use customerName from customerObj!
      companyGstin: customerObj.gstin,
      invoiceNo: invNo,
      invoiceDate: invoiceDateStr ? new Date(invoiceDateStr) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      notes: data.notes,
      paymentTerms: data.paymentTerms || 30,
      poNo: data.poNo,
      otherExpense: data.otherExpense || 0,
      roundOff: data.roundOff || 0,
      customerAddress: encryptIfPresent(data.customerAddress),
      deliveryAddress: encryptIfPresent(data.deliveryAddress),
      totalTaxable,
      totalGst,
      igstAmount,
      cgstAmount,
      sgstAmount,
      grandTotal,
      totalPurchaseCost: totalPurchaseCost, // Write plaintext for now as required by schema
      totalPurchaseCostEnc: encryptFinancialData(totalPurchaseCost),
      grossProfit: grossProfit, // Write plaintext
      grossProfitEnc: encryptFinancialData(grossProfit),
      ...buildGstExtrasData(data), // Spread all the extras!
      items: {
        create: processedItems
      }
    },
    include: { items: true, user: true, customer: true }
  });

  for (const consum of layerConsumptionsToCreate) {
    const saleItem = sale.items[consum.itemIndex];
    if (saleItem) {
      await tx.layerConsumption.create({
        data: {
          userId,
          layerId: consum.layerId,
          saleItemId: saleItem.id,
          quantityConsumed: consum.quantityConsumed,
          unitCostEnc: consum.unitCostEnc
        }
      });
    }
  }

  await postSaleAccounting(userId, sale, userId, tx, { bypassPeriodCheck: true });

  return sale;
}







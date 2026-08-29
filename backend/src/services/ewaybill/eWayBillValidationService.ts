export class EWayBillValidationService {
  public static validatePayload(payload: any) {
    if (!payload.documentNo) throw new Error('Missing Document Number');
    if (!payload.documentDate) throw new Error('Missing Document Date');
    if (!payload.supplierGstin) throw new Error('Missing Supplier GSTIN');
    if (!payload.buyerGstin && payload.supplyType === 'O') throw new Error('Missing Buyer GSTIN');
    if (!payload.approxDistance || payload.approxDistance <= 0) throw new Error('Invalid Approximate Distance');
    
    if (payload.transportMode === '1') {
      if (!payload.vehicleNo && !payload.transporterId) {
        throw new Error('Either Vehicle Number or Transporter ID is required for road transport');
      }
    } else if (['2', '3', '4'].includes(payload.transportMode)) {
      if (!payload.transportDocNo) {
        throw new Error('Transport Document Number is required for Rail/Air/Ship');
      }
    }

    if (payload.totalInvoiceValue < 0) {
      throw new Error('Invalid Invoice Value');
    }
  }
}

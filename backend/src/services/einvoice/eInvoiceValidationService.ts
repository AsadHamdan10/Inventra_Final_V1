export class EInvoiceValidationService {
  static validatePayload(payload: any): string[] {
    const errors: string[] = [];

    // GSTIN Validation
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!payload.SellerDtls?.Gstin || !gstinRegex.test(payload.SellerDtls.Gstin)) {
      errors.push('Seller GSTIN is missing or invalid format.');
    }

    if (!payload.BuyerDtls?.Gstin || (!gstinRegex.test(payload.BuyerDtls.Gstin) && payload.BuyerDtls.Gstin !== 'URP')) {
      errors.push('Buyer GSTIN is missing or invalid format.');
    }

    // Pincode validation
    if (!payload.SellerDtls?.Pin || payload.SellerDtls.Pin.toString().length !== 6) {
      errors.push('Seller Pincode must be exactly 6 digits.');
    }

    if (!payload.BuyerDtls?.Pin || payload.BuyerDtls.Pin.toString().length !== 6) {
      errors.push('Buyer Pincode must be exactly 6 digits. (Missing in Sale record)');
    }

    // Item validation
    if (!payload.ItemList || payload.ItemList.length === 0) {
      errors.push('At least one item is required.');
    }

    payload.ItemList?.forEach((item: any) => {
      if (!item.HsnCd) errors.push(`HSN Code missing for item ${item.SlNo}`);
      if (item.Qty <= 0) errors.push(`Quantity must be greater than 0 for item ${item.SlNo}`);
    });

    // Value validation
    if (payload.ValDtls?.TotInvVal <= 0) {
      errors.push('Total Invoice Value must be greater than 0.');
    }

    if (payload.TranDtls?.SupTyp !== 'B2B' && payload.TranDtls?.SupTyp !== 'SEZWP' && payload.TranDtls?.SupTyp !== 'SEZWOP' && payload.TranDtls?.SupTyp !== 'EXPWP' && payload.TranDtls?.SupTyp !== 'EXPWOP' && payload.TranDtls?.SupTyp !== 'DEXP') {
      errors.push('Transaction type must be B2B or Export/SEZ for E-Invoicing.');
    }

    return errors;
  }
}

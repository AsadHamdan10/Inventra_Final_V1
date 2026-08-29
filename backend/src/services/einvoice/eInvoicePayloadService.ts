import { PrismaClient, Sale, SalesReturn, SaleItem, SalesReturnItem } from '@prisma/client';

export class EInvoicePayloadService {
  /**
   * Deterministically maps first two characters of GSTIN to State Code.
   */
  static extractStateCode(gstin: string | null): string {
    if (!gstin || gstin.length < 2) return '99'; // Default for missing or OIDAR
    return gstin.substring(0, 2);
  }

  static buildSalePayload(sale: Sale, items: SaleItem[], user: any) {
    const isInterstate = Number(sale.igstAmount) > 0;
    
    // Construct Seller Details
    const sellerDtls = {
      Gstin: user.gstin,
      LglNm: user.companyName,
      Addr1: user.addressLine1 || 'NA',
      Addr2: user.addressLine2 || null,
      Loc: user.city || 'NA',
      Pin: user.pincode ? parseInt(user.pincode, 10) : 0,
      Stcd: this.extractStateCode(user.gstin)
    };

    // Construct Buyer Details
    const buyerDtls = {
      Gstin: sale.companyGstin || 'URP',
      LglNm: sale.companyName,
      Pos: this.extractStateCode(sale.companyGstin),
      Addr1: sale.customerAddress || 'NA',
      Loc: sale.customerCity || 'NA',
      Pin: sale.customerPincode ? parseInt(sale.customerPincode, 10) : 0,
      Stcd: this.extractStateCode(sale.companyGstin)
    };

    // Dispatch Details (Optional, defaulting to Seller if missing)
    const dispDtls = {
      Nm: user.companyName,
      Addr1: user.addressLine1 || 'NA',
      Loc: user.city || 'NA',
      Pin: user.pincode ? parseInt(user.pincode, 10) : 0,
      Stcd: this.extractStateCode(user.gstin)
    };

    // Shipping Details (Optional)
    let shipDtls = undefined;
    if (sale.shipCompanyName) {
      shipDtls = {
        Gstin: sale.shipGstin || 'URP',
        LglNm: sale.shipCompanyName,
        Addr1: sale.shipAddressLine1 || 'NA',
        Addr2: sale.shipAddressLine2 || null,
        Loc: sale.shipCity || 'NA',
        Pin: sale.shipPincode ? parseInt(sale.shipPincode, 10) : 0,
        Stcd: this.extractStateCode(sale.shipGstin)
      };
    }

    // Item Details
    const itemList = items.map((item, index) => {
      const isIgst = isInterstate;
      return {
        SlNo: (index + 1).toString(),
        PrdDesc: item.materialName,
        IsServc: 'N',
        HsnCd: item.hsnCode || '999999',
        Qty: Number(item.quantity),
        Unit: 'NOS',
        UnitPrice: Number(item.unitPrice),
        TotAmt: Number(item.quantity) * Number(item.unitPrice),
        Discount: 0,
        PreTaxVal: 0,
        AssAmt: Number(item.taxableAmount),
        GstRt: Number(item.gstPercent),
        IgstAmt: isIgst ? Number(item.gstAmount) : 0,
        CgstAmt: isIgst ? 0 : (Number(item.gstAmount) / 2),
        SgstAmt: isIgst ? 0 : (Number(item.gstAmount) / 2),
        CesRt: 0,
        CesAmt: 0,
        CesNonAdvlAmt: 0,
        StateCesRt: 0,
        StateCesAmt: 0,
        StateCesNonAdvlAmt: 0,
        OthChrg: 0,
        TotItemVal: Number(item.taxableAmount) + Number(item.gstAmount)
      };
    });

    // Invoice Total
    const valDtls = {
      AssVal: Number(sale.totalTaxable),
      CgstVal: Number(sale.cgstAmount),
      SgstVal: Number(sale.sgstAmount),
      IgstVal: Number(sale.igstAmount),
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: Number(sale.otherExpense),
      RndOffAmt: Number(sale.roundOff),
      TotInvVal: Number(sale.grandTotal)
    };

    // Format DD/MM/YYYY for NIC API
    const docDate = new Date(sale.invoiceDate);
    const dtFormatted = `${docDate.getDate().toString().padStart(2, '0')}/${(docDate.getMonth() + 1).toString().padStart(2, '0')}/${docDate.getFullYear()}`;

    const docDtls = {
      Typ: 'INV',
      No: sale.invoiceNo,
      Dt: dtFormatted
    };

    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: 'B2B',
        RegRev: 'N',
        EcmGstin: null,
        IgstOnIntra: 'N'
      },
      DocDtls: docDtls,
      SellerDtls: sellerDtls,
      BuyerDtls: buyerDtls,
      DispDtls: dispDtls,
      ShipDtls: shipDtls,
      ItemList: itemList,
      ValDtls: valDtls
    };
  }

  static buildSalesReturnPayload(salesReturn: SalesReturn, items: SalesReturnItem[], originalSale: Sale, user: any) {
    const isInterstate = Number(salesReturn.igstAmount) > 0;
    
    // Construct Seller Details
    const sellerDtls = {
      Gstin: user.gstin,
      LglNm: user.companyName,
      Addr1: user.addressLine1 || 'NA',
      Addr2: user.addressLine2 || null,
      Loc: user.city || 'NA',
      Pin: user.pincode ? parseInt(user.pincode, 10) : 0,
      Stcd: this.extractStateCode(user.gstin)
    };

    // Construct Buyer Details
    const buyerDtls = {
      Gstin: originalSale.companyGstin || 'URP',
      LglNm: originalSale.companyName,
      Pos: this.extractStateCode(originalSale.companyGstin),
      Addr1: originalSale.customerAddress || 'NA',
      Loc: salesReturn.customerCity || originalSale.customerCity || 'NA',
      Pin: salesReturn.customerPincode ? parseInt(salesReturn.customerPincode, 10) : (originalSale.customerPincode ? parseInt(originalSale.customerPincode, 10) : 0),
      Stcd: this.extractStateCode(originalSale.companyGstin)
    };

    // Item Details
    const itemList = items.map((item, index) => {
      const isIgst = isInterstate;
      return {
        SlNo: (index + 1).toString(),
        PrdDesc: item.materialName,
        IsServc: 'N',
        HsnCd: '999999', // simplified mapping
        Qty: Number(item.quantity),
        Unit: 'NOS',
        UnitPrice: Number(item.unitPrice),
        TotAmt: Number(item.quantity) * Number(item.unitPrice),
        Discount: 0,
        PreTaxVal: 0,
        AssAmt: Number(item.taxableAmount),
        GstRt: Number(item.gstPercent),
        IgstAmt: isIgst ? Number(item.gstAmount) : 0,
        CgstAmt: isIgst ? 0 : (Number(item.gstAmount) / 2),
        SgstAmt: isIgst ? 0 : (Number(item.gstAmount) / 2),
        CesRt: 0,
        CesAmt: 0,
        CesNonAdvlAmt: 0,
        StateCesRt: 0,
        StateCesAmt: 0,
        StateCesNonAdvlAmt: 0,
        OthChrg: 0,
        TotItemVal: Number(item.taxableAmount) + Number(item.gstAmount)
      };
    });

    // Invoice Total
    const valDtls = {
      AssVal: Number(salesReturn.totalTaxable),
      CgstVal: Number(salesReturn.cgstAmount),
      SgstVal: Number(salesReturn.sgstAmount),
      IgstVal: Number(salesReturn.igstAmount),
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0, // no other charges on return standard
      RndOffAmt: 0, // Simplified
      TotInvVal: Number(salesReturn.grandTotal)
    };

    const docDate = new Date(salesReturn.returnDate);
    const dtFormatted = `${docDate.getDate().toString().padStart(2, '0')}/${(docDate.getMonth() + 1).toString().padStart(2, '0')}/${docDate.getFullYear()}`;
    
    // Original doc date
    const origDate = new Date(originalSale.invoiceDate);
    const origDtFormatted = `${origDate.getDate().toString().padStart(2, '0')}/${(origDate.getMonth() + 1).toString().padStart(2, '0')}/${origDate.getFullYear()}`;

    const docDtls = {
      Typ: 'CRN',
      No: salesReturn.creditNoteNo || `CRN-${salesReturn.id}`,
      Dt: dtFormatted
    };

    const precDocDtls = [
        {
            InvNo: originalSale.invoiceNo,
            InvDt: origDtFormatted
        }
    ];

    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: 'B2B',
        RegRev: 'N',
        EcmGstin: null,
        IgstOnIntra: 'N'
      },
      DocDtls: docDtls,
      SellerDtls: sellerDtls,
      BuyerDtls: buyerDtls,
      ItemList: itemList,
      ValDtls: valDtls,
      PrecDocDtls: precDocDtls
    };
  }
}

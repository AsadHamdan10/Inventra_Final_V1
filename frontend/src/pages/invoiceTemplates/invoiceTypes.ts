// ── Shared Invoice Data Types ─────────────────────────────────

export interface InvoiceItem {
  materialName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  purchasePrice?: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  itemTotal: number;
}

export interface CompanyInfo {
  companyName: string;
  gstin?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  mobile?: string;
  email?: string;
  panNumber?: string;
}

// ── Bank info passed in at print-time (first available BankAccount) ──
export interface BankInfo {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
}

export interface InvoiceData {
  // Invoice meta
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  poNo?: string;
  paymentTerms?: number;

  // Type labels — change for purchase invoices
  invoiceLabel?: string; // 'Tax Invoice' | 'Proforma Invoice' | 'Purchase Invoice' etc.

  // Company (seller / your company)
  company: CompanyInfo;

  // Customer / Vendor
  partyName: string;        // companyName or vendorName
  partyGstin?: string;
  partyAddress?: string;
  deliveryAddress?: string;
  partyLabel?: string;      // 'Bill To' | 'Vendor' etc.
  partyMobile?: string;
  partyEmail?: string;
  // Items
  items: InvoiceItem[];

  // Totals
  totalTaxable: number;
  totalGst: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  otherExpense?: number;
  roundOff?: number;
  grandTotal: number;
  isInterState?: boolean;

  // Payment
  paymentReceived?: number;
  amountInWords?: string;

  // Bank
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountName?: string;
  branchName?: string;

  // Footer
  termsAndConditions?: string;
  notes?: string;

  // ── Professional GST Invoice Template — additive-only, all optional ──
  // Populated only when a user fills in the "Additional Invoice Details"
  // section. Every existing template ignores these fields entirely.
  referenceNo?: string;
  referenceDate?: string;
  deliveryNote?: string;
  buyerOrderNo?: string;
  buyerOrderDate?: string;
  dispatchDocNo?: string;
  deliveryNoteDate?: string;
  modeOfPayment?: string;
  otherReference?: string;
  transportName?: string;
  lrNumber?: string;
  destination?: string;
  vehicleNumber?: string;
  ewayBillNo?: string;
  termsOfDelivery?: string;

  // Ship To (Consignee) — null/undefined means "same as buyer".
  useBuyerAsShipping?: boolean;
  shipTo?: ShipToInfo;
}

export interface ShipToInfo {
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  contactPerson?: string;
  mobile?: string;
}

// ── Ship-to address as a single multi-line string ──────────────
// Mirrors companyAddressLines() below so ShipTo obeys the same
// addressAlignment / addressStyle settings via <AddressBlock>.
export function shipToAddressLines(ship: ShipToInfo): string {
  return [
    ship.addressLine1,
    ship.addressLine2,
    [ship.city, ship.state].filter(Boolean).join(', '),
    ship.pincode,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Convert sales record → InvoiceData ───────────────────────
export function saleToInvoiceData(sale: any, company: CompanyInfo, bank?: BankInfo): InvoiceData {
  return {
    invoiceNo: sale.invoiceNo,
    invoiceDate: sale.invoiceDate,
    dueDate: sale.dueDate,
    poNo: sale.poNo,
    paymentTerms: sale.paymentTerms,
    invoiceLabel: 'Tax Invoice',
    company,
    partyName: sale.companyName,
    partyGstin: sale.companyGstin,
    partyAddress: sale.customerAddress || sale.customer?.address || '',
    deliveryAddress:sale.deliveryAddress ||sale.customer?.deliveryAddress ||sale.customerAddress ||sale.customer?.address ||'',
    partyMobile: sale.customer?.phone || '',
    partyEmail: sale.customer?.email || '',
    partyLabel: 'Bill To',
    items: sale.items ?? [],
    totalTaxable: +sale.totalTaxable,
    totalGst: +sale.totalGst,
    cgstAmount: +sale.cgstAmount,
    sgstAmount: +sale.sgstAmount,
    igstAmount: +sale.igstAmount,
    otherExpense: +sale.otherExpense,
    roundOff: +sale.roundOff,
    grandTotal: +sale.grandTotal,
    isInterState: +sale.igstAmount > 0,
    paymentReceived: +sale.paymentReceived,

bankName: bank?.bankName,
accountName: bank?.accountName,
accountNumber: bank?.accountNumber,
ifscCode: bank?.ifscCode,
branchName: bank?.branchName,

amountInWords: numberToWords(+sale.grandTotal),
notes: sale.notes,

    // ── Professional GST Invoice Template — additive-only ───────
    // All undefined/optional; every field falls back gracefully so
    // existing templates (which never read these) are unaffected.
    referenceNo: sale.referenceNo || undefined,
    referenceDate: sale.referenceDate || undefined,
    deliveryNote: sale.deliveryNote || undefined,
    buyerOrderNo: sale.buyerOrderNo || undefined,
    buyerOrderDate: sale.buyerOrderDate || undefined,
    dispatchDocNo: sale.dispatchDocNo || undefined,
    deliveryNoteDate: sale.deliveryNoteDate || undefined,
    modeOfPayment: sale.modeOfPayment || undefined,
    otherReference: sale.otherReference || undefined,
    transportName: sale.transportName || undefined,
    lrNumber: sale.lrNumber || undefined,
    destination: sale.destination || undefined,
    vehicleNumber: sale.vehicleNumber || undefined,
    ewayBillNo: sale.ewayBillNo || undefined,
    termsOfDelivery: sale.termsOfDelivery || undefined,
    useBuyerAsShipping: sale.useBuyerAsShipping ?? true,
    shipTo: sale.shipCompanyName || sale.shipAddressLine1 || sale.shipGSTIN
      ? {
          companyName: sale.shipCompanyName || undefined,
          addressLine1: sale.shipAddressLine1 || undefined,
          addressLine2: sale.shipAddressLine2 || undefined,
          city: sale.shipCity || undefined,
          state: sale.shipState || undefined,
          pincode: sale.shipPincode || undefined,
          gstin: sale.shipGSTIN || undefined,
          contactPerson: sale.shipContactPerson || undefined,
          mobile: sale.shipMobile || undefined,
        }
      : undefined,
  };
}

// ── Convert purchase record → InvoiceData ────────────────────
export function purchaseToInvoiceData(purchase: any, company: CompanyInfo): InvoiceData {
  return {
    invoiceNo: purchase.billNo,
    invoiceDate: purchase.billDate,
    invoiceLabel: 'Purchase Invoice',
    company,
    partyName: purchase.vendorName,
    partyGstin: purchase.vendorGstin,
    partyLabel: 'Vendor',
    items: (purchase.items ?? []).map((it: any) => ({
      ...it,
      unitPrice: it.purchaseRate ?? it.unitPrice,
    })),
    totalTaxable: +purchase.totalTaxable,
    totalGst: +purchase.totalGst,
    cgstAmount: +purchase.cgstAmount,
    sgstAmount: +purchase.sgstAmount,
    igstAmount: +purchase.igstAmount,
    otherExpense: +purchase.otherExpense,
    roundOff: +purchase.roundOff,
    grandTotal: +purchase.grandTotal,
    isInterState: +purchase.igstAmount > 0,
    amountInWords: numberToWords(+purchase.grandTotal),
    notes: purchase.notes,
  };
}

// ── Number to Words (Indian system) ──────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n: number): string {
  if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  return twoDigits(n);
}

export function numberToWords(amount: number): string {
  if (amount <= 0) return 'Zero Rupees Only';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = '';
  if (rupees >= 10000000) {
    words += threeDigits(Math.floor(rupees / 10000000)) + ' Crore ';
  }
  if (rupees % 10000000 >= 100000) {
    words += threeDigits(Math.floor((rupees % 10000000) / 100000)) + ' Lakh ';
  }
  if (rupees % 100000 >= 1000) {
    words += threeDigits(Math.floor((rupees % 100000) / 1000)) + ' Thousand ';
  }
  if (rupees % 1000 >= 100) {
    words += ones[Math.floor((rupees % 1000) / 100)] + ' Hundred ';
  }
  if (rupees % 100 > 0) {
    words += twoDigits(rupees % 100) + ' ';
  }
  words = words.trim() + ' Rupees';
  if (paise > 0) words += ' and ' + twoDigits(paise) + ' Paise';
  return words + ' Only';
}

// ── Company address as a single multi-line string ─────────────
// Additive helper only — does NOT change CompanyInfo, retrieval,
// or mapping. Templates use this + <AddressBlock> so the company
// address obeys the same global addressAlignment / addressStyle
// settings as buyer/delivery addresses.
export function companyAddressLines(company: CompanyInfo): string {
  return [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.state].filter(Boolean).join(', '),
    company.pincode,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Format helpers ────────────────────────────────────────────
export const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};
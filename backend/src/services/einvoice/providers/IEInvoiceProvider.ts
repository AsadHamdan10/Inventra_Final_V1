export interface EInvoiceGenerateResult {
  success: boolean;
  irn?: string;
  ackNo?: string;
  ackDate?: Date;
  qrCode?: string;
  signedInvoice?: string;
  errorDetails?: string;
  governmentResponse: any;
}

export interface EInvoiceCancelResult {
  success: boolean;
  cancelDate?: Date;
  errorDetails?: string;
  governmentResponse: any;
}

export interface IEInvoiceProvider {
  generateInvoice(payload: any): Promise<EInvoiceGenerateResult>;
  cancelInvoice(irn: string, reason: string): Promise<EInvoiceCancelResult>;
}

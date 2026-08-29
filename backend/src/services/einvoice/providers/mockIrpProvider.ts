import { IEInvoiceProvider, EInvoiceGenerateResult, EInvoiceCancelResult } from './IEInvoiceProvider';
import * as crypto from 'crypto';

export class MockIrpProvider implements IEInvoiceProvider {
  
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateInvoice(payload: any): Promise<EInvoiceGenerateResult> {
    await this.delay(500); // simulate network latency
    
    // Simulate validation failure if pincode is missing or invalid length
    if (!payload.BuyerDtls?.Pin || payload.BuyerDtls.Pin.toString().length !== 6) {
      return {
        success: false,
        errorDetails: '2150: Buyer Pincode is mandatory and must be 6 digits.',
        governmentResponse: { error: 'Invalid Pin', isMock: true, note: 'DEVELOPMENT MOCK DATA' }
      };
    }

    // Generate deterministic mock IRN based on doc number and date
    const seed = `${payload.DocDtls.Typ}-${payload.DocDtls.No}-${payload.DocDtls.Dt}`;
    const irn = crypto.createHash('sha256').update(seed).digest('hex');
    const ackNo = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const ackDate = new Date();

    return {
      success: true,
      irn,
      ackNo,
      ackDate,
      qrCode: `MOCK_QR_${irn}`,
      signedInvoice: `MOCK_SIGNED_JWT_${irn}`,
      governmentResponse: {
        Success: 'Y',
        Irn: irn,
        AckNo: ackNo,
        AckDt: ackDate.toISOString(),
        Info: 'DEVELOPMENT MOCK DATA'
      }
    };
  }

  async cancelInvoice(irn: string, reason: string): Promise<EInvoiceCancelResult> {
    await this.delay(500);
    
    return {
      success: true,
      cancelDate: new Date(),
      governmentResponse: {
        Success: 'Y',
        Irn: irn,
        CancelDate: new Date().toISOString(),
        Info: 'DEVELOPMENT MOCK DATA'
      }
    };
  }
}

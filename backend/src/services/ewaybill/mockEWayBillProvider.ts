import { IEWayBillProvider } from './eWayBillProvider';

export class MockEWayBillProvider implements IEWayBillProvider {
  public isMock = true;

  async generateEWayBill(payload: any): Promise<any> {
    // 8. Provider failure isolation
    if (payload.supplierGstin === 'ERROR_500') {
      throw new Error('Provider Internal Server Error');
    }
    if (payload.supplierGstin === 'TIMEOUT') {
      await new Promise(r => setTimeout(r, 2000));
      throw new Error('Provider Timeout');
    }
    if (payload.vehicleNo === 'INVALID') {
      return { success: false, error: 'Invalid Vehicle Number format' };
    }
    if (payload.transporterId === 'INVALID_GSTIN') {
      return { success: false, error: 'Invalid Transporter ID' };
    }
    
    // Simulate Duplicate
    if (payload.documentNo === 'DUPLICATE_INV') {
      return { success: false, error: 'Duplicate E-Way Bill found for this document' };
    }

    const ewbNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + Math.max(1, Math.ceil((payload.approxDistance || 100) / 200))); // Mock 200km per day

    return {
      success: true,
      ewbNo,
      ewbDate: new Date().toISOString(),
      validUntil: validUntil.toISOString(),
      qrCode: 'mock_qr_code_data',
      status: 'GENERATED'
    };
  }

  async cancelEWayBill(ewbNo: string, reason: string): Promise<any> {
    if (ewbNo === 'ERROR_CANCEL') {
      return { success: false, error: 'Provider Error during Cancellation' };
    }
    return {
      success: true,
      cancelDate: new Date().toISOString()
    };
  }

  async updatePartB(ewbNo: string, transportDetails: any): Promise<any> {
    if (ewbNo === 'ERROR_PART_B') {
      return { success: false, error: 'Provider Error during Part-B Update' };
    }
    return {
      success: true,
      updatedDate: new Date().toISOString()
    };
  }

  async extendValidity(ewbNo: string, extensionDetails: any): Promise<any> {
    if (ewbNo === 'ERROR_EXTEND') {
      return { success: false, error: 'Provider Error during Extension' };
    }
    const newValidUntil = new Date();
    newValidUntil.setDate(newValidUntil.getDate() + 1);
    return {
      success: true,
      validUntil: newValidUntil.toISOString()
    };
  }

  async getEWayBill(ewbNo: string): Promise<any> {
    return {
      success: true,
      ewbNo,
      status: 'ACTIVE'
    };
  }
}

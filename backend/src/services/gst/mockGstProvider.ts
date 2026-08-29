import { IGstProvider } from './gstProvider';

export class MockGstProvider implements IGstProvider {
  async fileGstr1(payload: any): Promise<any> {
    if (payload.simulateError === 'NETWORK') {
      throw new Error('MOCK DEVELOPMENT PROVIDER: Network timeout');
    }
    if (payload.simulateError === 'VALIDATION') {
      return { success: false, error: 'MOCK DEVELOPMENT PROVIDER: Invalid HSN in payload' };
    }
    return {
      success: true,
      ackNo: 'MOCK_GSTR1_' + Date.now(),
      filedAt: new Date().toISOString(),
      message: 'MOCK DEVELOPMENT PROVIDER: Filed successfully'
    };
  }

  async fileGstr3b(payload: any): Promise<any> {
    if (payload.simulateError === 'VALIDATION') {
      return { success: false, error: 'MOCK DEVELOPMENT PROVIDER: ITC claims exceed 2B' };
    }
    return {
      success: true,
      ackNo: 'MOCK_GSTR3B_' + Date.now(),
      filedAt: new Date().toISOString(),
      message: 'MOCK DEVELOPMENT PROVIDER: Filed successfully'
    };
  }
}

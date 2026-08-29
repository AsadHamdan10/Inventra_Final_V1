export interface IEWayBillProvider {
  generateEWayBill(payload: any): Promise<any>;
  cancelEWayBill(ewbNo: string, reason: string): Promise<any>;
  updatePartB(ewbNo: string, transportDetails: any): Promise<any>;
  extendValidity(ewbNo: string, extensionDetails: any): Promise<any>;
  getEWayBill(ewbNo: string): Promise<any>;
}

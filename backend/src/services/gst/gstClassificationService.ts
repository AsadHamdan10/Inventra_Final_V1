export class GstClassificationService {
  public static isValidGstin(gstin: string | null | undefined): boolean {
    if (!gstin) return false;
    const clean = gstin.trim();
    // Simplified pattern: 2 digits, 10 alphanumeric PAN, 1 alphanumeric, 1 Z, 1 alphanumeric
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    return regex.test(clean);
  }

  public static classifySale(
    companyGstin: string | null | undefined, 
    grandTotal: number, 
    customerStateCode: string | null, 
    userStateCode: string | null
  ): 'B2B' | 'B2CL' | 'B2CS' | 'INVALID_GSTIN' {
    if (companyGstin && companyGstin.trim() !== '') {
      if (this.isValidGstin(companyGstin)) {
        return 'B2B';
      } else {
        return 'INVALID_GSTIN';
      }
    }

    // B2C logic
    if (customerStateCode && userStateCode && customerStateCode !== userStateCode) {
      if (grandTotal > 250000) {
        return 'B2CL'; // Interstate > 2.5L
      }
    }
    
    return 'B2CS'; // Intrastate or Interstate <= 2.5L
  }

  public static extractStateCode(gstin: string | null | undefined): string | null {
    if (!gstin || gstin.trim().length < 2) return null;
    return gstin.trim().substring(0, 2);
  }
}

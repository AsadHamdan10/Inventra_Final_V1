export class UqcService {
  private static readonly UQC_MAP: Record<string, string> = {
    'nos': 'NOS',
    'no': 'NOS',
    'number': 'NOS',
    'numbers': 'NOS',
    'kg': 'KGS',
    'kgs': 'KGS',
    'kilogram': 'KGS',
    'kilograms': 'KGS',
    'ltr': 'LTR',
    'ltrs': 'LTR',
    'litre': 'LTR',
    'litres': 'LTR',
    'liter': 'LTR',
    'liters': 'LTR',
    'mtr': 'MTR',
    'mtrs': 'MTR',
    'meter': 'MTR',
    'meters': 'MTR',
    'metres': 'MTR',
    'pcs': 'PCS',
    'pieces': 'PCS',
    'box': 'BOX',
    'boxes': 'BOX',
    'pac': 'PAC',
    'pack': 'PAC',
    'packs': 'PAC',
    'pkt': 'PAC',
    'ton': 'TON',
    'tons': 'TON',
    'tonne': 'TON',
    'tonnes': 'TON',
  };

  public static normalizeUqc(unit: string | null | undefined): string | null {
    if (!unit) return null;
    const clean = unit.trim().toLowerCase();
    return this.UQC_MAP[clean] || null;
  }
}

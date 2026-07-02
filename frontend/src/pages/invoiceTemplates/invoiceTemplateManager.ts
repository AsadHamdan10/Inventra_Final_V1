// ── Invoice Template Manager ──────────────────────────────────
// Manages selected invoice template IDs via localStorage.
// No database involvement.

export type InvoiceType = 'sales' | 'purchase';

const KEYS = {
  sales: 'salesInvoiceTemplate',
  purchase: 'purchaseInvoiceTemplate',
} as const;

export const TEMPLATE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  tags: string[];
  accentColor: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 1,
    name: 'Classic GST',
    description: 'Traditional GST invoice for traders, distributors & manufacturers.',
    tags: ['GST', 'Traditional', 'Trader'],
    accentColor: '#1e40af',
  },
  {
    id: 2,
    name: 'Modern Professional',
    description: 'Clean spacing with blue accents and a large grand total box.',
    tags: ['Modern', 'Blue', 'Professional'],
    accentColor: '#0ea5e9',
  },
  {
    id: 3,
    name: 'Corporate Premium',
    description: 'Large logo section with professional information cards.',
    tags: ['Corporate', 'Logo', 'Executive'],
    accentColor: '#7c3aed',
  },
  {
    id: 4,
    name: 'Minimal White',
    description: 'Black & white, extremely clean. Ink-saving design.',
    tags: ['Minimal', 'B&W', 'Ink-saving'],
    accentColor: '#111827',
  },
  {
    id: 5,
    name: 'Premium Gradient',
    description: 'Modern colored header with a premium business look.',
    tags: ['Gradient', 'Premium', 'Colorful'],
    accentColor: '#8b5cf6',
  },
  {
    id: 6,
    name: 'Retail Style',
    description: 'Vyapar-inspired compact layout for quick billing.',
    tags: ['Retail', 'Compact', 'Vyapar'],
    accentColor: '#16a34a',
  },
  {
    id: 7,
    name: 'Tally Style',
    description: 'Traditional accountant-friendly ledger-like format.',
    tags: ['Tally', 'Accountant', 'Ledger'],
    accentColor: '#b45309',
  },
  {
    id: 8,
    name: 'Boxed Professional',
    description: 'All sections boxed with strong data separation.',
    tags: ['Boxed', 'Structured', 'Clear'],
    accentColor: '#0f766e',
  },
  {
    id: 9,
    name: 'GST Detailed',
    description: 'Compliance-focused with HSN-wise GST breakdowns.',
    tags: ['GST', 'Compliance', 'Detailed'],
    accentColor: '#dc2626',
  },
  {
    id: 10,
    name: 'Executive Premium',
    description: 'Highest-end design with branding, QR code & signature area.',
    tags: ['Executive', 'QR Code', 'Luxury'],
    accentColor: '#1e293b',
  },
  {
    id: 11,
    name: 'Professional GST Invoice',
    description: 'Traditional tax-invoice grid with Ship To, e-Way Bill & transport details.',
    tags: ['GST', 'Transport', 'e-Way Bill'],
    accentColor: '#1e3a5f',
  },
];

export function getSelectedTemplate(type: InvoiceType): TemplateId {
  const stored = localStorage.getItem(KEYS[type]);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  if (TEMPLATE_IDS.includes(parsed as TemplateId)) return parsed as TemplateId;
  return 1; // default
}

export function setSelectedTemplate(type: InvoiceType, id: TemplateId): void {
  localStorage.setItem(KEYS[type], String(id));
}

export function getTemplateInfo(id: TemplateId): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
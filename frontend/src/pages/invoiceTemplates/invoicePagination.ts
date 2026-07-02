// ── invoicePagination.ts ──────────────────────────────────────
// Shared multi-page A4 pagination engine for all invoice templates.
// Splits items into pages, repeats header on every page, and
// ensures footer/totals only appear on the last page.

import { InvoiceItem } from './invoiceTypes';

// ── A4 dimensions (screen px at 96dpi) ───────────────────────
export const A4_WIDTH_PX  = 794;
export const A4_HEIGHT_PX = 1123;

// ── Per-template row height estimates (px) ───────────────────
// These are safe conservative heights. Tweak per template if needed.
export const ROW_HEIGHT_PX: Record<string, number> = {
  classic:    22,   // T01 – small padding rows
  modern:     26,   // T02 – slightly taller rows
  corporate:  24,   // T03
  minimal:    22,   // T04
  gradient:   24,   // T05
  retail:     22,   // T06 compact
  tally:      18,   // T07 – monospace compact
  boxed:      24,   // T08
  gstdetail:  24,   // T09
  executive:  26,   // T10
  professionalgst: 22, // T11
};

// ── How much vertical space the header consumes per template (px) ─
// header = company + invoice meta + party details + table thead
export const HEADER_HEIGHT_PX: Record<string, number> = {
  classic:   210,
  modern:    240,
  corporate: 240,
  minimal:   200,
  gradient:  230,
  retail:    180,
  tally:     140,
  boxed:     220,
  gstdetail: 250,
  executive: 260,
  professionalgst: 300,
};

// ── Footer/totals block (only last page) ─────────────────────
// Approx height needed for: GST summary + totals + bank + sig + notes
export const FOOTER_HEIGHT_PX: Record<string, number> = {
  classic:   320,
  modern:    340,
  corporate: 320,
  minimal:   260,
  gradient:  300,
  retail:    280,
  tally:     200,
  boxed:     320,
  gstdetail: 380,
  executive: 360,
  professionalgst: 340,
};

// ── Page margins ─────────────────────────────────────────────
export const PAGE_PADDING_PX = 40; // top + bottom padding inside each page

/**
 * Given all items and template key, returns an array of page arrays.
 * Each inner array is the slice of items for that page.
 *
 * On intermediate pages: only items shown.
 * On last page: items + footer content.
 *
 * @param items      Full list of invoice items
 * @param template   One of the keys in ROW_HEIGHT_PX
 * @returns          Array of item-arrays, one per page
 */
export function paginateItems(
  items: InvoiceItem[],
  template: string
): InvoiceItem[][] {
  if (items.length === 0) return [[]];

  const rowH     = ROW_HEIGHT_PX[template]   ?? 24;
  const headerH  = HEADER_HEIGHT_PX[template] ?? 220;
  const footerH  = FOOTER_HEIGHT_PX[template] ?? 320;
  const usable   = A4_HEIGHT_PX - PAGE_PADDING_PX;

  // How many rows fit on page 1 (with header, no footer since we don't know yet)
  // We reserve footer space on last page — computed iteratively below.
  const rowsPage1 = Math.max(1, Math.floor((usable - headerH) / rowH));
  const rowsOther = Math.max(1, Math.floor((usable - headerH) / rowH));
  const rowsLast  = Math.max(1, Math.floor((usable - headerH - footerH) / rowH));

  const pages: InvoiceItem[][] = [];
  let remaining = [...items];

  // Page 1
  const p1Count = Math.min(remaining.length, rowsPage1);
  // Peek: is this also the last page?
  if (remaining.length <= rowsLast || rowsLast >= remaining.length) {
    // Everything fits on one page with footer
    pages.push(remaining);
    return pages;
  }

  pages.push(remaining.splice(0, p1Count));

  // Intermediate pages
  while (remaining.length > rowsLast) {
    pages.push(remaining.splice(0, rowsOther));
  }

  // Last page (with footer)
  pages.push(remaining);

  return pages;
}

/**
 * Utility: total page count for display ("Page X of Y")
 */
export function getPageCount(items: InvoiceItem[], template: string): number {
  return paginateItems(items, template).length;
}

// ── Print / PDF CSS injected as a <style> tag ────────────────
export const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  body {
    margin: 0 !important;
    padding: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .inv-page {
    page-break-after: always;
    break-after: page;
  }
  .inv-page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .inv-no-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
`;
// ── Template 11: Professional GST Invoice ────────────────────
// Traditional GST tax-invoice grid (inspired by classic e-Invoice/
// e-Way Bill layouts): Consignee + Buyer side by side, a full
// "Additional Invoice Details" meta grid (reference no, buyer's
// order no, dispatch doc, transport, e-Way Bill, etc.), an
// HSN-wise GST summary table, and a declaration/bank/signature
// footer. This is a brand-new, additional template only — it does
// not replace or modify any of Template01–Template10.
//
// Multi-page A4 support: header repeats, footer only on last page.
// Optional fields that are empty are hidden completely (no empty
// rows/cells left in the meta grid) so the layout stays compact.

import {
  InvoiceData,
  InvoiceItem,
  fmt,
  fmtDate,
  companyAddressLines,
  shipToAddressLines,
} from './invoiceTypes';
import { paginateItems, PRINT_CSS } from './invoicePagination';
import { InvoiceSettings, getInvoiceSettings } from './invoiceSettings';
import AddressBlock from './AddressBlock';

interface Props { data: InvoiceData; settings?: InvoiceSettings; }

const ACCENT = '#1e3a5f';
const BORDER = '#9ca3af';

// ── Small helper: a labelled meta cell, omitted entirely when empty ──
function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ padding: '3px 6px', color: '#4b5563', fontSize: '10px', width: '42%', borderTop: `1px solid ${BORDER}` }}>{label}</td>
      <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 600, borderTop: `1px solid ${BORDER}` }}>{value}</td>
    </tr>
  );
}

// ── Resolve the effective shipping block: buyer address when
//    useBuyerAsShipping is enabled (or unset — matches every
//    existing invoice), otherwise the dedicated Ship To fields. ──
function resolveShipping(data: InvoiceData) {
  const useBuyer = data.useBuyerAsShipping ?? true;
  if (useBuyer || !data.shipTo) {
    return {
      isBuyer: true,
      name: data.partyName,
      address: data.partyAddress,
      gstin: data.partyGstin,
    };
  }
  return {
    isBuyer: false,
    name: data.shipTo.companyName || data.partyName,
    address: shipToAddressLines(data.shipTo) || undefined,
    gstin: data.shipTo.gstin,
    contactPerson: data.shipTo.contactPerson,
    mobile: data.shipTo.mobile,
  };
}

// ── Page header (repeated on every page) ─────────────────────
function PageHeader({ data, settings }: { data: InvoiceData; settings: InvoiceSettings }) {
  const ship = resolveShipping(data);
  const hasMeta = !!(
    data.referenceNo || data.deliveryNote || data.buyerOrderNo || data.dispatchDocNo ||
    data.modeOfPayment || data.otherReference || data.transportName || data.lrNumber ||
    data.destination || data.vehicleNumber || data.ewayBillNo || data.termsOfDelivery
  );

  return (
    <div>
      <div
        style={{
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: '1.5px',
          marginBottom: '10px',
          textTransform: 'uppercase',
        }}
      >
        {data.invoiceLabel ?? 'Tax Invoice'}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: `1px solid ${BORDER}` }}>
        <tbody>
          <tr>
            {/* Supplier */}
            <td style={{ width: '50%', border: `1px solid ${BORDER}`, verticalAlign: 'top', padding: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px', color: ACCENT, marginBottom: '2px' }}>
                {data.company.companyName}
              </div>
              <AddressBlock text={companyAddressLines(data.company)} settings={settings} style={{ fontSize: '12px', lineHeight: '1.5' }} />
              {data.company.gstin && <div style={{ fontSize: '11px', marginTop: '3px' }}><strong>GSTIN/UIN:</strong> {data.company.gstin}</div>}
              {data.company.mobile && <div style={{ fontSize: '11px' }}><strong>Mobile:</strong> {data.company.mobile}</div>}
              {data.company.email && <div style={{ fontSize: '11px' }}><strong>E-Mail:</strong> {data.company.email}</div>}
            </td>

            {/* Invoice meta */}
            <td style={{ width: '50%', border: `1px solid ${BORDER}`, verticalAlign: 'top', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px', fontSize: '11px' }}><strong>Invoice No.</strong><br />{data.invoiceNo}</td>
                    <td style={{ padding: '6px', fontSize: '11px', borderLeft: `1px solid ${BORDER}` }}><strong>Dated</strong><br />{fmtDate(data.invoiceDate)}</td>
                  </tr>
                  {data.ewayBillNo && (
                    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td colSpan={2} style={{ padding: '6px', fontSize: '11px' }}><strong>e-Way Bill No.</strong> {data.ewayBillNo}</td>
                    </tr>
                  )}
                  {data.modeOfPayment && (
                    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td colSpan={2} style={{ padding: '6px', fontSize: '11px' }}><strong>Mode/Terms of Payment</strong> {data.modeOfPayment}</td>
                    </tr>
                  )}
                  {data.dueDate && (
                    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td colSpan={2} style={{ padding: '6px', fontSize: '11px' }}><strong>Due Date</strong> {fmtDate(data.dueDate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            {/* Consignee (Ship To) */}
            <td style={{ border: `1px solid ${BORDER}`, verticalAlign: 'top', padding: '8px' }}>
              <div style={{ fontWeight: 700, color: ACCENT, fontSize: '12px', marginBottom: '4px' }}>
                {ship.isBuyer ? 'Consignee (Ship to)' : 'Consignee (Ship to)'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{ship.name}</div>
              {ship.address && <AddressBlock text={ship.address} settings={settings} style={{ marginTop: '3px', fontSize: '12px', lineHeight: '1.5' }} />}
              {ship.gstin && <div style={{ marginTop: '3px', fontSize: '11px' }}><strong>GSTIN/UIN:</strong> {ship.gstin}</div>}
              {!ship.isBuyer && ship.contactPerson && <div style={{ fontSize: '11px' }}><strong>Contact:</strong> {ship.contactPerson}</div>}
              {!ship.isBuyer && ship.mobile && <div style={{ fontSize: '11px' }}><strong>Mobile:</strong> {ship.mobile}</div>}
            </td>

            {/* Buyer (Bill To) */}
            <td style={{ border: `1px solid ${BORDER}`, verticalAlign: 'top', padding: '8px' }}>
              <div style={{ fontWeight: 700, color: ACCENT, fontSize: '12px', marginBottom: '4px' }}>Buyer (Bill to)</div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{data.partyName}</div>
              {data.partyAddress && <AddressBlock text={data.partyAddress} settings={settings} style={{ marginTop: '3px', fontSize: '12px', lineHeight: '1.5' }} />}
              {data.partyGstin && <div style={{ marginTop: '3px', fontSize: '11px' }}><strong>GSTIN/UIN:</strong> {data.partyGstin}</div>}
              {data.partyMobile && <div style={{ fontSize: '11px' }}><strong>Mobile:</strong> {data.partyMobile}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Additional Invoice Details — only rendered if at least one field is present, and only non-empty rows shown */}
      {hasMeta && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: `1px solid ${BORDER}`, borderTop: 'none', marginBottom: '0' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', border: `1px solid ${BORDER}`, verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <MetaRow label="Reference No. & Date." value={data.referenceNo ? `${data.referenceNo}${data.referenceDate ? ' dt. ' + fmtDate(data.referenceDate) : ''}` : undefined} />
                    <MetaRow label="Buyer's Order No." value={data.buyerOrderNo} />
                    <MetaRow label="Dated" value={data.buyerOrderDate ? fmtDate(data.buyerOrderDate) : undefined} />
                    <MetaRow label="Delivery Note" value={data.deliveryNote} />
                    <MetaRow label="Delivery Note Date" value={data.deliveryNoteDate ? fmtDate(data.deliveryNoteDate) : undefined} />
                    <MetaRow label="Other References" value={data.otherReference} />
                  </tbody>
                </table>
              </td>
              <td style={{ width: '50%', border: `1px solid ${BORDER}`, borderLeft: 'none', verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <MetaRow label="Dispatch Doc No." value={data.dispatchDocNo} />
                    <MetaRow label="Dispatched through" value={data.transportName} />
                    <MetaRow label="Bill of Lading/LR-RR No." value={data.lrNumber} />
                    <MetaRow label="Destination" value={data.destination} />
                    <MetaRow label="Motor Vehicle No." value={data.vehicleNumber} />
                    <MetaRow label="Terms of Delivery" value={data.termsOfDelivery} />
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Item table header row (repeated on every page) ────────────
function TableHead() {
  const cols = ['Sl No.', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Taxable Value', 'GST %', 'GST Amt', 'Total Amount'];
  return (
    <thead>
      <tr style={{ background: ACCENT, color: '#fff' }}>
        {cols.map((h) => (
          <th
            key={h}
            style={{
              fontSize: '10px',
              padding: '6px 5px',
              textAlign: h === 'Description of Goods' ? 'left' : ['Rate', 'Taxable Value', 'GST Amt', 'Total Amount'].includes(h) ? 'right' : 'center',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid #34506e',
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ItemRows({ items, startIndex }: { items: InvoiceItem[]; startIndex: number }) {
  return (
    <tbody>
      {items.map((it, i) => (
        <tr key={i} style={{ background: (startIndex + i) % 2 === 0 ? '#fafafa' : '#fff' }}>
          <td style={{ padding: '5px', textAlign: 'center', fontSize: '10px', border: `1px solid ${BORDER}` }}>{startIndex + i + 1}</td>
          <td style={{ padding: '5px', fontSize: '11px', fontWeight: 600, border: `1px solid ${BORDER}` }}>{it.materialName}</td>
          <td style={{ padding: '5px', textAlign: 'center', fontSize: '10px', border: `1px solid ${BORDER}` }}>{it.hsnCode || '—'}</td>
          <td style={{ padding: '5px', textAlign: 'center', fontSize: '10px', border: `1px solid ${BORDER}` }}>{it.quantity}</td>
          <td style={{ padding: '5px', textAlign: 'center', fontSize: '10px', border: `1px solid ${BORDER}` }}>Nos</td>
          <td style={{ padding: '5px', textAlign: 'right', fontSize: '10px', border: `1px solid ${BORDER}` }}>{fmt(it.unitPrice)}</td>
          <td style={{ padding: '5px', textAlign: 'right', fontSize: '10px', border: `1px solid ${BORDER}` }}>{fmt(it.taxableAmount)}</td>
          <td style={{ padding: '5px', textAlign: 'center', fontSize: '10px', border: `1px solid ${BORDER}` }}>{it.gstPercent}%</td>
          <td style={{ padding: '5px', textAlign: 'right', fontSize: '10px', border: `1px solid ${BORDER}` }}>{fmt(it.gstAmount)}</td>
          <td style={{ padding: '5px', textAlign: 'right', fontSize: '10px', fontWeight: 700, border: `1px solid ${BORDER}` }}>{fmt(it.itemTotal)}</td>
        </tr>
      ))}
    </tbody>
  );
}

// ── Last-page footer: HSN summary, totals, bank, declaration ─
function LastPageFooter({ data, settings }: { data: InvoiceData; settings: InvoiceSettings }) {
  const isIGST = data.isInterState;

  // Group items by HSN for the compliance-style HSN/SAC summary table
  const hsnGroups = Array.from(new Set(data.items.map((i) => i.hsnCode || '—'))).map((hsn) => {
    const group = data.items.filter((i) => (i.hsnCode || '—') === hsn);
    const taxable = group.reduce((s, i) => s + Number(i.taxableAmount || 0), 0);
    const gst = group.reduce((s, i) => s + Number(i.gstAmount || 0), 0);
    const rate = group[0]?.gstPercent ?? 0;
    return { hsn, taxable, gst, rate };
  });

  return (
    <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <table style={{ minWidth: '260px', borderCollapse: 'collapse', fontSize: '11px', border: `1px solid ${BORDER}` }}>
          <tbody>
            {[
              ['Taxable Amount', fmt(data.totalTaxable)],
              isIGST ? ['IGST', fmt(data.igstAmount)] : null,
              !isIGST ? ['CGST', fmt(data.cgstAmount)] : null,
              !isIGST ? ['SGST', fmt(data.sgstAmount)] : null,
              data.otherExpense ? ['Other Expense', fmt(data.otherExpense)] : null,
              data.roundOff ? ['Round Off', fmt(data.roundOff)] : null,
            ].filter(Boolean).map((row: any) => (
              <tr key={row[0]}>
                <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}` }}>{row[0]}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: `1px solid ${BORDER}` }}>{row[1]}</td>
              </tr>
            ))}
            <tr style={{ background: ACCENT, color: '#fff' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: '12px' }}>Grand Total</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>{fmt(data.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.amountInWords && (
        <div style={{ border: `1px solid ${BORDER}`, padding: '6px 10px', marginBottom: '10px', fontSize: '11px' }}>
          <strong>Amount Chargeable (in words):</strong> INR {data.amountInWords}
        </div>
      )}

      {/* HSN/SAC-wise GST summary */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', border: `1px solid ${BORDER}`, marginBottom: '10px' }}>
        <thead>
          <tr style={{ background: '#eef2f7' }}>
            <th style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'left' }}>HSN/SAC</th>
            <th style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>Taxable Value</th>
            <th style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>{isIGST ? 'IGST Rate' : 'GST Rate'}</th>
            <th style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          {hsnGroups.map((g) => (
            <tr key={g.hsn}>
              <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}` }}>{g.hsn}</td>
              <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>{fmt(g.taxable)}</td>
              <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>{g.rate}%</td>
              <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>{fmt(g.gst)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}` }}>Total</td>
            <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>{fmt(data.totalTaxable)}</td>
            <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}` }}></td>
            <td style={{ padding: '4px 6px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>{fmt(data.totalGst)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        {/* Declaration + Bank Details */}
        <div style={{ flex: 1, fontSize: '10px' }}>
          {settings.showTerms && data.termsAndConditions && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: 700 }}>Declaration</div>
              <div style={{ color: '#4b5563' }}>{data.termsAndConditions}</div>
            </div>
          )}
          {settings.showNotes && data.notes && (
            <div style={{ marginBottom: '6px' }}><strong>Notes:</strong> {data.notes}</div>
          )}
          {settings.showBankDetails && (data.bankName || data.accountNumber) && (
            <div style={{ border: `1px solid ${BORDER}`, padding: '6px 8px', marginTop: '4px' }}>
              <div style={{ fontWeight: 700, color: ACCENT, marginBottom: '3px' }}>Company's Bank Details</div>
              {data.accountName && <div>A/c Holder's Name: <strong>{data.accountName}</strong></div>}
              {data.bankName && <div>Bank Name: <strong>{data.bankName}</strong></div>}
              {data.accountNumber && <div>A/c No.: <strong>{data.accountNumber}</strong></div>}
              {(data.branchName || data.ifscCode) && (
                <div>Branch & IFS Code: <strong>{[data.branchName, data.ifscCode].filter(Boolean).join(' & ')}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* Signature */}
        {settings.showSignature && (
          <div style={{ minWidth: '200px', textAlign: 'right', fontSize: '11px' }}>
            <div style={{ marginBottom: '36px' }}>for {data.company.companyName}</div>
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '4px', display: 'inline-block', minWidth: '160px' }}>
              Authorised Signatory
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageFooter({ pageNum, totalPages, isLast }: { pageNum: number; totalPages: number; isLast: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${ACCENT}`, marginTop: '10px', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#6b7280' }}>
      <span>{isLast ? 'This is a Computer Generated Invoice' : `continued to page number ${pageNum + 1}`}</span>
      <span>Page {pageNum} of {totalPages}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Template11ProfessionalGST({ data, settings: settingsProp }: Props) {
  const settings = settingsProp ?? getInvoiceSettings();
  const pages = paginateItems(data.items, 'professionalgst');
  const totalPages = pages.length;

  let globalIndex = 0;

  return (
    <>
      <style>{PRINT_CSS}</style>
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === totalPages - 1;
        const startIndex = globalIndex;
        globalIndex += pageItems.length;

        return (
          <div
            key={pageIdx}
            className="inv-page"
            style={{
              fontFamily: 'Arial, sans-serif',
              fontSize: '11px',
              color: '#111',
              background: '#fff',
              padding: '18px',
              border: `1px solid ${BORDER}`,
              boxSizing: 'border-box',
              width: '794px',
              minHeight: '1123px',
              position: 'relative',
            }}
          >
            <PageHeader data={data} settings={settings} />

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', marginBottom: '10px', border: `1px solid ${BORDER}` }}>
              <TableHead />
              <ItemRows items={pageItems} startIndex={startIndex} />
            </table>

            {isLast && <LastPageFooter data={data} settings={settings} />}

            <PageFooter pageNum={pageIdx + 1} totalPages={totalPages} isLast={isLast} />
          </div>
        );
      })}
    </>
  );
}

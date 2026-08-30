// GST inter-state determination — single source of truth.
//
// BACKGROUND / BUG THIS FIXES:
// Several places in this codebase were determining CGST+SGST vs IGST by
// comparing free-text strings that don't actually represent the same thing
// (e.g. a tenant's `state` field against a customer's `deliveryAddress` full
// address string — these will almost never match, so the comparison nearly
// always evaluated to "inter-state" even for same-state customers). Others
// fell back to a client-supplied `shipState` with no backend verification
// (violates the "GST is backend-authoritative" rule). The purchase-return
// path used stub functions that always returned `false`/`null`.
//
// THE FIX: use the GST State Code, which is the authoritative, standards-based
// signal — it's the first two digits of any valid 15-character GSTIN (e.g.
// "27AACCT1234A1Z5" -> "27" -> Maharashtra), assigned by the Indian tax
// authority and never ambiguous the way a free-text state name is (whether
// "Maharashtra", "MAHARASHTRA", "MH", or a numeric code "27" was entered).
// When a GSTIN is available for both parties, comparing state codes is
// unambiguous. Only when a GSTIN is missing (e.g. an unregistered/consumer
// customer) do we fall back to comparing free-text state names, and if even
// that is unavailable we default to intra-state (CGST+SGST) — the safer
// assumption for an unregistered local customer, and never a value the
// frontend can override.

const GSTIN_PATTERN = /^\d{2}[A-Z0-9]{13}$/;

/** Extracts the 2-digit GST State Code from a GSTIN, or null if invalid/absent. */
export function getGstStateCode(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(clean)) return null;
  return clean.slice(0, 2);
}

function normalizeStateName(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Determines whether a transaction between the tenant (company) and a
 * counterparty (customer/vendor) is inter-state, for CGST+SGST vs IGST.
 *
 * Priority: GSTIN state code (authoritative) > free-text state name > default
 * to intra-state. Never accepts a caller-supplied "isInterState" override —
 * callers should always compute this here rather than trust client input.
 */
export function determineInterStateByGstin(
  companyGstin: string | null | undefined,
  companyState: string | null | undefined,
  counterpartyGstin: string | null | undefined,
  counterpartyState: string | null | undefined
): boolean {
  const companyCode = getGstStateCode(companyGstin);
  const counterpartyCode = getGstStateCode(counterpartyGstin);
  if (companyCode && counterpartyCode) {
    return companyCode !== counterpartyCode;
  }

  const companyName = normalizeStateName(companyState);
  const counterpartyName = normalizeStateName(counterpartyState);
  if (companyName && counterpartyName) {
    return companyName !== counterpartyName;
  }

  // Insufficient data to determine state on one side — default to intra-state
  // (CGST+SGST) rather than defaulting to the more punitive IGST assumption.
  return false;
}

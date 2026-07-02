// ── InvoiceRenderer.tsx ───────────────────────────────────────
// Loads the selected invoice template dynamically.
// Pass `templateId` and `data` props.
//
// Also threads global InvoiceSettings (address alignment/style,
// section visibility) to every template, and live-updates when
// settings change anywhere in the app — no save/reload required.

import { forwardRef, useEffect, useState } from 'react';
import { InvoiceData } from './invoiceTypes';
import { TemplateId } from './invoiceTemplateManager';
import { InvoiceSettings, getInvoiceSettings, subscribeInvoiceSettings } from './invoiceSettings';
import Template01Classic from './Template01Classic';
import Template02Modern from './Template02Modern';
import {
  Template03Corporate,
  Template04Minimal,
  Template05Gradient,
  Template06Retail,
  Template07Tally,
  Template08Boxed,
  Template09DetailedGST,
  Template10Executive,
} from './Template03to10';
import Template11ProfessionalGST from './Template11ProfessionalGST';

interface Props {
  templateId: TemplateId;
  data: InvoiceData;
  /** Optional override — if omitted, reads live global settings and stays in sync. */
  settings?: InvoiceSettings;
}

/** Renders the chosen invoice template. Wrap in a ref to generate PDFs. */
const InvoiceRenderer = forwardRef<HTMLDivElement, Props>(
  ({ templateId, data, settings: settingsProp }, ref) => {
    const [liveSettings, setLiveSettings] = useState<InvoiceSettings>(() => settingsProp ?? getInvoiceSettings());

    useEffect(() => {
      if (settingsProp) {
        setLiveSettings(settingsProp);
        return;
      }
      setLiveSettings(getInvoiceSettings());
      const unsubscribe = subscribeInvoiceSettings(setLiveSettings);
      return unsubscribe;
    }, [settingsProp]);

    const Template = getTemplate(templateId);
    return (
      <div ref={ref}>
        <Template data={data} settings={liveSettings} />
      </div>
    );
  }
);
InvoiceRenderer.displayName = 'InvoiceRenderer';
export default InvoiceRenderer;

function getTemplate(id: TemplateId): React.ComponentType<{ data: InvoiceData; settings?: InvoiceSettings }> {
  switch (id) {
    case 1:  return Template01Classic;
    case 2:  return Template02Modern;
    case 3:  return Template03Corporate;
    case 4:  return Template04Minimal;
    case 5:  return Template05Gradient;
    case 6:  return Template06Retail;
    case 7:  return Template07Tally;
    case 8:  return Template08Boxed;
    case 9:  return Template09DetailedGST;
    case 10: return Template10Executive;
    case 11: return Template11ProfessionalGST;
    default: return Template01Classic;
  }
}
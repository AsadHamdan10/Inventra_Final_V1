import React, { useState, useEffect } from 'react';
import { eInvoiceApi } from '../../services/eInvoiceApi';
import { useSearchParams } from 'react-router-dom';

const EInvoicePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('saleId');
  const [einvoice, setEinvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (saleId) {
      loadEInvoice(Number(saleId));
    }
  }, [saleId]);

  const loadEInvoice = async (id: number) => {
    try {
      setLoading(true);
      const data = await eInvoiceApi.getBySale(id);
      setEinvoice(data);
    } catch (err) {
      console.error(err);
      setEinvoice(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!saleId) return;
    try {
      setLoading(true);
      const data = await eInvoiceApi.generateForSale(Number(saleId));
      setEinvoice(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!saleId) return <div>No Sale ID provided.</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>E-Invoice Actions</h2>
      {loading && <div>Loading...</div>}
      {!loading && !einvoice && (
        <div>
          <p>No E-Invoice exists for Sale #{saleId}.</p>
          <button onClick={handleGenerate}>Generate E-Invoice</button>
        </div>
      )}
      {!loading && einvoice && (
        <div style={{ border: '1px solid #ccc', padding: 20 }}>
          <p>Status: {einvoice.status}</p>
          {einvoice.irn && <p><b>IRN:</b> {einvoice.irn}</p>}
        </div>
      )}
    </div>
  );
};
export default EInvoicePage;

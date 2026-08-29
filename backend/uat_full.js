
const API = "http://localhost:5000/api/v1";

async function runFull() {
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_master2", password: "QA@Pass123" })
    });
    const token = (await loginRes.json()).accessToken;
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
    
    const wh = (await (await fetch(`${API}/inventory/warehouses`, { method: "POST", headers, body: JSON.stringify({ code: "W2", name: "Warehouse 2", warehouseType: "GENERAL" }) })).json()).data;
    
    const vendor = (await (await fetch(`${API}/vendors`, { method: "POST", headers, body: JSON.stringify({ name: "Supplier 2", email: "sup2@qa.com", status: "ACTIVE" }) })).json());
    
    const cust = (await (await fetch(`${API}/customers`, { method: "POST", headers, body: JSON.stringify({ name: "Buyer 2", email: "buy2@qa.com", status: "ACTIVE" }) })).json());
    
    const item = (await (await fetch(`${API}/materials`, { method: "POST", headers, body: JSON.stringify({ itemType: "FINISHED_GOOD", materialName: "Laptop 2", hsnCode: "8471", unit: "NOS", standardPrice: 50000, standardCost: 40000, inventoryTracked: true, purchaseEnabled: true, salesEnabled: true, gstRate: 18, taxability: "TAXABLE" }) })).json());

    const v = vendor.data || vendor;
    const i = item.data || item;
    
    // GRN
    const grnRes = await fetch(`${API}/goods-receipts`, {
      method: "POST", headers,
      body: JSON.stringify({
        vendorId: v.id,
        vendorName: v.name,
        warehouseId: wh.id,
        grnDate: new Date().toISOString(),
        deliveryChallanNo: "CH-006",
        items: [{ materialId: i.id, materialName: i.materialName, orderedQty: 100, receivedQty: 100, acceptedQty: 100, unitPrice: 40000, unit: "NOS", gstPercent: 18, warehouseId: wh.id }]
      })
    });
    const grnData = await grnRes.json();
    console.log("GRN Created:", grnData.grnNo || grnData);

    const postGrnRes = await fetch(`${API}/goods-receipts/${grnData.id || grnData.data?.id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "POSTED" })
    });
    console.log("POST GRN result:", await postGrnRes.json());
    
    const stockRes = await fetch(`${API}/inventory/layers?materialId=${i.id}&warehouseId=${wh.id}`, { headers });
    console.log("Stock:", await stockRes.json());

    // Sale
    const saleRes = await fetch(`${API}/sales`, {
      method: "POST", headers,
      body: JSON.stringify({
        customerId: cust.data?.id || cust.id,
        saleDate: new Date().toISOString(),
        items: [{ materialId: i.id, quantity: 30, unitPrice: 50000, gstPercent: 18, warehouseId: wh.id }]
      })
    });
    const sale = await saleRes.json();
    console.log("Sale Created:", sale.invoiceNo || sale);

    const postSaleRes = await fetch(`${API}/sales/${sale.id || sale.data?.id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "COMPLETED" })
    });
    console.log("POST Sale result:", await postSaleRes.json());

    const stockRes2 = await fetch(`${API}/inventory/layers?materialId=${i.id}&warehouseId=${wh.id}`, { headers });
    console.log("Stock after sale:", await stockRes2.json());

  } catch(e) { console.error(e); }
}
runFull();


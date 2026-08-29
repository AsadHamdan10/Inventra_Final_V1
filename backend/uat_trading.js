
const API = "http://localhost:5000/api/v1";

async function runTradingE2E() {
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_trading11", password: "QA@Pass123" })
    });
    const token = (await loginRes.json()).accessToken;
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
    
    // Create Warehouse
    const whRes = await fetch(`${API}/inventory/warehouses`, {
      method: "POST", headers,
      body: JSON.stringify({ code: "MAIN5", name: "Main Warehouse 5", warehouseType: "GENERAL" })
    });
    const wh = (await whRes.json()).data;
    
    // Create Item
    const itemRes = await fetch(`${API}/materials`, {
      method: "POST", headers,
      body: JSON.stringify({ itemType: "FINISHED_GOOD", materialName: "QA Laptop 5", hsnCode: "8471", unit: "NOS", standardPrice: 50000, standardCost: 40000, inventoryTracked: true, purchaseEnabled: true, salesEnabled: true, gstRate: 18, taxability: "TAXABLE" })
    });
    const itemData = await itemRes.json();
    const item = itemData.data || itemData;
    
    // Create Vendor
    const vendorRes = await fetch(`${API}/vendors`, {
      method: "POST", headers,
      body: JSON.stringify({ name: "QA Supplier 5", email: "supp5@qa.com", status: "ACTIVE" })
    });
    const vendData = await vendorRes.json();
    const vendor = vendData.data || vendData;
    
    // Create Customer
    const custRes = await fetch(`${API}/customers`, {
      method: "POST", headers,
      body: JSON.stringify({ name: "QA Buyer 5", email: "buyer5@qa.com", status: "ACTIVE" })
    });
    const custData = await custRes.json();
    const cust = custData.data || custData;
    
    // Create GRN (Purchase Receipt)
    console.log("Receiving 100 laptops @ 40,000...");
    const grnRes = await fetch(`${API}/goods-receipts`, {
      method: "POST", headers,
      body: JSON.stringify({
        vendorId: vendor.id,
        vendorName: vendor.name,
        warehouseId: wh.id,
        grnDate: new Date().toISOString(),
        deliveryChallanNo: "CH-005",
        items: [{ materialId: item.id, materialName: item.materialName, orderedQty: 100, receivedQty: 100, acceptedQty: 100, unitPrice: 40000, unit: "NOS", gstPercent: 18, warehouseId: wh.id }]
      })
    });
    const grnData = await grnRes.json();
    if (!grnRes.ok) throw new Error("GRN failed: " + JSON.stringify(grnData));
    const grn = grnData;
    console.log("GRN Created:", grn.grnNo);

    // POST GRN
    const postGrnRes = await fetch(`${API}/goods-receipts/${grn.id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "POSTED" })
    });
    if (!postGrnRes.ok) throw new Error("GRN Post Failed");

    // Query Stock
    const stockRes = await fetch(`${API}/inventory/layers?materialId=${item.id}&warehouseId=${wh.id}`, { headers });
    const stockData = await stockRes.json();
    console.log("Stock Layers after GRN:", stockData);
    
    // Sale
    console.log("Selling 30 laptops @ 50,000...");
    const saleRes = await fetch(`${API}/sales`, {
      method: "POST", headers,
      body: JSON.stringify({
        customerId: cust.id,
        saleDate: new Date().toISOString(),
        items: [{ materialId: item.id, quantity: 30, unitPrice: 50000, gstPercent: 18, warehouseId: wh.id }]
      })
    });
    const saleData = await saleRes.json();
    if (!saleRes.ok) throw new Error("Sale failed: " + JSON.stringify(saleData));
    const sale = saleData;
    console.log("Sale Created:", sale.invoiceNo);

    // POST Sale
    const postSaleRes = await fetch(`${API}/sales/${sale.id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "COMPLETED" })
    });
    if (!postSaleRes.ok) throw new Error("Sale Post Failed");

    const stockRes2 = await fetch(`${API}/inventory/layers?materialId=${item.id}&warehouseId=${wh.id}`, { headers });
    console.log("Stock Layers after sale:", await stockRes2.json());
    
  } catch (err) {
    console.error("Trading E2E Error:", err);
  }
}
runTradingE2E();


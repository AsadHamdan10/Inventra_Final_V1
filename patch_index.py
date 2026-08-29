
import re

with open("backend/src/index.ts", "r", encoding="utf-8") as f:
    data = f.read()

imports = """import eWayBillRoutes from './routes/eWayBillRoutes';
import gstFilingRoutes from './routes/gstFilingRoutes';
// Procurement
import purchaseRequisitions from './routes/purchaseRequisitions';
import purchaseQuotations from './routes/purchaseQuotations';
import purchaseOrdersProcurement from './routes/purchaseOrdersProcurement';
import goodsReceipts from './routes/goodsReceipts';
// Inventory
import inventoryOperations from './routes/inventoryOperations';
// Manufacturing
import bom from './routes/bom';
import workCenters from './routes/workCenters';
import routings from './routes/routings';
import productionOrders from './routes/productionOrders';
// Finance
import financialStatements from './routes/financialStatements';
"""

data = data.replace("import eWayBillRoutes from './routes/eWayBillRoutes';\nimport gstFilingRoutes from './routes/gstFilingRoutes';", imports)

usages = """app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/ewaybill`, eWayBillRoutes);
// Procurement
app.use(`${API}/purchase-requisitions`, purchaseRequisitions);
app.use(`${API}/purchase-quotations`, purchaseQuotations);
app.use(`${API}/purchase-orders`, purchaseOrdersProcurement);
app.use(`${API}/goods-receipts`, goodsReceipts);
// Inventory
app.use(`${API}/inventory`, inventoryOperations);
// Manufacturing
app.use(`${API}/bom`, bom);
app.use(`${API}/work-centers`, workCenters);
app.use(`${API}/routings`, routings);
app.use(`${API}/production-orders`, productionOrders);
// Finance
app.use(`${API}/finance`, financialStatements);
"""

data = data.replace("app.use(`${API}/admin`, adminRoutes);\napp.use(`${API}/ewaybill`, eWayBillRoutes);", usages)

with open("backend/src/index.ts", "w", encoding="utf-8") as f:
    f.write(data)


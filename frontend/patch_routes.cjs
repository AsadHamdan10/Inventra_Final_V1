const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
if (!code.includes('EWayBillPage')) {
  code = code.replace(/import EInvoicePage from '\.\/pages\/gst\/EInvoicePage';/, "import EInvoicePage from './pages/gst/EInvoicePage';\nimport EWayBillPage from './pages/compliance/EWayBillPage';");
  
  // Add route
  code = code.replace(/<Route path="e-invoice" element=\{<EInvoicePage \/>\} \/>/, "<Route path=\"e-invoice\" element={<EInvoicePage />} />\n            <Route path=\"ewaybill\" element={<EWayBillPage />} />");
  
  fs.writeFileSync('src/App.tsx', code);
}

// Add to sidebar (if needed)
try {
  let sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
  if (!sidebar.includes('ewaybill')) {
    sidebar = sidebar.replace(/to="\/gst"/, "to=\"/ewaybill\" className=\"nav-link text-white\">\n          <i className=\"bi bi-truck me-2\"></i> E-Way Bill\n        </Link>\n        <Link to=\"/gst\"");
    fs.writeFileSync('src/components/layout/Sidebar.tsx', sidebar);
  }
} catch (e) {}


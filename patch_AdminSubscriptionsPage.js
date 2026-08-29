
const fs = require("fs");
let code = fs.readFileSync("frontend/src/pages/admin/AdminSubscriptionsPage.tsx", "utf8");

code = code.replace("import { PageHeader, Spinner, Modal, Button } from", "import { PageHeader, Spinner, Modal } from");

code = code.replace(/<Button size="sm" variant="outline" onClick=\{(.*?)\}>Receive Pay<\/Button>/g, "<button className=\"btn-secondary text-sm px-3 py-1\" onClick={$1}>Receive Pay</button>");
code = code.replace(/<Button type="submit" isLoading=\{payMut\.isPending\}>Record Payment<\/Button>/g, "<button type=\"submit\" className=\"btn-primary\">Record Payment</button>");
code = code.replace(/isOpen=\{payModal\}/g, "open={payModal}");

fs.writeFileSync("frontend/src/pages/admin/AdminSubscriptionsPage.tsx", code, "utf8");


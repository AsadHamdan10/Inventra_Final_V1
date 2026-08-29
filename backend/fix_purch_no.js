const fs = require('fs');

let purchaseStr = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

// The replacement we did earlier didn't work because `count` wasn't there!
// I need to intercept the data.
purchaseStr = purchaseStr.replace(
  /const \{ items, \.\.\.data \} = parsed\.data;/,
  "const { items, ...data } = parsed.data;\n    const { billNo: clientBillNo, ...restData } = data;\n    const finalBillNo = await generateDocumentNumber('PUR', userId, new Date(restData.billDate));\n    const dataWithBillNo = { ...restData, billNo: finalBillNo };"
);

purchaseStr = purchaseStr.replace(
  /userId, \.\.\.data,/,
  "userId, ...dataWithBillNo,"
);

fs.writeFileSync('src/controllers/purchaseController.ts', purchaseStr);

const fs = require('fs');
const path = require('path');

const srcSaleControllerPath = path.join(__dirname, 'src', 'controllers', 'saleController.ts');
let content = fs.readFileSync(srcSaleControllerPath, 'utf8');

const startRecv = content.indexOf('export async function addReceivablePayment');
const endRecv = content.indexOf('export async function getSalePayments');
if (startRecv === -1 || endRecv === -1) throw new Error("Could not find addReceivablePayment bounds");

const oldRecv = content.substring(startRecv, endRecv);
const newAddRecv = `export async function addReceivablePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const saleId = parseInt(req.params.id);
    if (!(await assertTenantOwnership(userId, 'sales', saleId))) return res.status(403).json({ error: 'Access denied.' });
    
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });
    
    const payment = await prisma.$transaction(async (tx) => {
        const sale = await tx.$queryRaw\`SELECT grand_total as "grandTotal", payment_received as "paymentReceived" FROM sales WHERE id = \${saleId} FOR UPDATE\`;
        if (!sale || sale.length === 0) throw new Error('Sale not found');
        
        const grandTotal = Number(sale[0].grandTotal);
        const currentPaid = Number(sale[0].paymentReceived);
        const newPayment = Number(parsed.data.amount);
        
        if (currentPaid + newPayment > grandTotal) {
             throw new Error(\`Overpayment rejected. Outstanding balance is \${grandTotal - currentPaid}\`);
        }
        
        const pmt = await tx.receivablePayment.create({
            data: { saleId, ...parsed.data, dateReceived: new Date(parsed.data.dateReceived) },
        });
        
        await tx.sale.update({ 
            where: { id: saleId }, 
            data: { paymentReceived: currentPaid + newPayment } 
        });
        
        return pmt;
    });

    await auditLog(userId, 'data_create', \`Payment received for sale #\${saleId}: \${parsed.data.amount}\`, req);
    res.status(201).json(payment);
  } catch (err) { 
    if (err.message && err.message.includes('Overpayment rejected')) {
        return res.status(400).json({ error: err.message });
    }
    next(err); 
  }
}

`;
content = content.replace(oldRecv, newAddRecv);

const startUpdatePmt = content.indexOf('export async function updatePayment');
const endUpdatePmt = content.indexOf('export async function deletePayment');

if (startUpdatePmt !== -1 && endUpdatePmt !== -1) {
    const oldUpdatePmt = content.substring(startUpdatePmt, endUpdatePmt);
    const newUpdatePmt = `export async function updatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const parsed = paymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed.' });
    }

    const userId = req.user!.userId;
    
    const payment = await prisma.$transaction(async (tx) => {
        const existing = await tx.receivablePayment.findUnique({ where: { id: paymentId } });
        if (!existing) throw new Error('Payment not found');
        
        const saleId = existing.saleId;
        const saleOwned = await tx.sale.findFirst({ where: { id: saleId, userId } });
        if (!saleOwned) throw new Error('Access denied');

        const sale = await tx.$queryRaw\`SELECT grand_total as "grandTotal", payment_received as "paymentReceived" FROM sales WHERE id = \${saleId} FOR UPDATE\`;
        
        const grandTotal = Number(sale[0].grandTotal);
        const currentPaid = Number(sale[0].paymentReceived);
        const oldPayment = Number(existing.amount);
        const newPayment = Number(parsed.data.amount);
        
        if ((currentPaid - oldPayment) + newPayment > grandTotal) {
             throw new Error(\`Overpayment rejected. Outstanding balance is \${grandTotal - (currentPaid - oldPayment)}\`);
        }
        
        const pmt = await tx.receivablePayment.update({
            where: { id: paymentId },
            data: {
              amount: parsed.data.amount,
              dateReceived: new Date(parsed.data.dateReceived),
              mode: parsed.data.mode,
              reference: parsed.data.reference,
              notes: parsed.data.notes,
            },
        });
        
        await tx.sale.update({
            where: { id: saleId },
            data: { paymentReceived: (currentPaid - oldPayment) + newPayment }
        });
        
        return pmt;
    });

    await auditLog(userId, 'data_update', \`Payment updated #\${paymentId}\`, req);
    res.json(payment);
  } catch (err) {
    if (err.message && err.message.includes('Overpayment rejected')) return res.status(400).json({ error: err.message });
    if (err.message === 'Payment not found') return res.status(404).json({ error: err.message });
    if (err.message === 'Access denied') return res.status(403).json({ error: err.message });
    next(err);
  }
}

`;
    content = content.replace(oldUpdatePmt, newUpdatePmt);
}

fs.writeFileSync(srcSaleControllerPath, content, 'utf8');
console.log('saleController.ts payments updated.');

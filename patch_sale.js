
const fs = require("fs");
const path = "backend/src/controllers/saleController.ts";
let code = fs.readFileSync(path, "utf8");

code = code.replace(/const saleItemSchema = z\.object\(\{[\s\S]*?\}\);/m, `const saleItemSchema = z.object({
  materialId: z.number(),
  warehouseId: z.number().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gstPercent: z.number().min(0).max(100).optional(),
});`);

code = code.replace(/const saleSchema = z\.object\(\{[\s\S]*?const paymentSchema/m, `const saleSchema = z.object({
  invoiceNo: z.string().optional().default(""),
  invoiceDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}(T.*)?$/),
  customerId: z.number(),
  paymentTerms: z.number().default(30),
  poNo: z.string().optional().default(""),
  otherExpense: z.number().min(0).default(0),
  roundOff: z.number().default(0),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  isInterState: z.boolean().optional().default(false),
  referenceNo: z.string().optional(),
  referenceDate: z.string().optional(),
  deliveryNote: z.string().optional(),
  buyerOrderNo: z.string().optional(),
  buyerOrderDate: z.string().optional(),
  dispatchDocNo: z.string().optional(),
  deliveryNoteDate: z.string().optional(),
  modeOfPayment: z.string().optional(),
  otherReference: z.string().optional(),
  transportName: z.string().optional(),
  lrNumber: z.string().optional(),
  destination: z.string().optional(),
  vehicleNumber: z.string().optional(),
  ewayBillNo: z.string().optional(),
  termsOfDelivery: z.string().optional(),
  shipCompanyName: z.string().optional(),
  shipAddressLine1: z.string().optional(),
  shipAddressLine2: z.string().optional(),
  shipCity: z.string().optional(),
  shipState: z.string().optional(),
  shipPincode: z.string().optional(),
  shipGSTIN: z.string().optional(),
  shipContactPerson: z.string().optional(),
  shipMobile: z.string().optional(),
  useBuyerAsShipping: z.boolean().optional(),
  items: z.array(saleItemSchema).min(1),
});

const paymentSchema`);

const createSaleMatch = code.match(/export async function createSale[\s\S]*?(?=export async function updateSale)/);
if(createSaleMatch) {
    const newCreateSale = `export async function createSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = saleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Validation failed.", details: parsed.error.flatten().fieldErrors }
      });
    }

    const { invoiceDate, customerId, items, ...options } = parsed.data;

    const sale = await prisma.$transaction(async (tx) => {
      const { createSaleInternal } = await import("../services/saleInternalService");
      return await createSaleInternal(
        userId,
        { customerId, invoiceDate, items, ...options },
        tx
      );
    });

    res.status(201).json({ success: true, data: decrypt(sale) });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: "SALE_CREATE_ERROR", message: err.message || "Failed to create sale." } });
  }
}

`;
    code = code.replace(createSaleMatch[0], newCreateSale);
}

const updateSaleMatch = code.match(/export async function updateSale[\s\S]*?(?=export async function deleteSale)/);
if(updateSaleMatch) {
    const newUpdateSale = `export async function updateSale(req: Request, res: Response, next: NextFunction) {
  return res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Financial records are immutable. Use Credit Notes to adjust completed sales." } });
}

`;
    code = code.replace(updateSaleMatch[0], newUpdateSale);
}

fs.writeFileSync(path, code, "utf8");
console.log("saleController.ts patched!");


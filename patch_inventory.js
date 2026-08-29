
const fs = require("fs");
let routes = fs.readFileSync("backend/src/routes/inventoryOperations.ts", "utf8");
routes += "\nrouter.get(\"/layers\", InventoryOperationController.listLayers);\n";
fs.writeFileSync("backend/src/routes/inventoryOperations.ts", routes, "utf8");

let controller = fs.readFileSync("backend/src/controllers/inventoryOperationController.ts", "utf8");
controller = controller.replace(/export class InventoryOperationController \{/, `export class InventoryOperationController {
    static async listLayers(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const { materialId, warehouseId } = req.query;
            
            const whereClause: any = { userId };
            if (materialId) whereClause.materialId = parseInt(materialId as string);
            if (warehouseId) whereClause.warehouseId = parseInt(warehouseId as string);
            
            const layers = await prisma.inventoryLayer.findMany({
                where: whereClause,
                include: {
                    material: true,
                    warehouse: true
                },
                orderBy: { receivedDate: "asc" }
            });
            
            // Do not expose unitCostEnc, only decode if needed or leave it out
            const result = layers.map(l => {
                const { unitCostEnc, ...safeLayer } = l;
                return safeLayer;
            });
            
            res.json({ success: true, data: result });
        } catch (e) { next(e); }
    }
`);
fs.writeFileSync("backend/src/controllers/inventoryOperationController.ts", controller, "utf8");
console.log("Inventory patched");


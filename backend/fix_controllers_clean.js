const fs = require('fs');

function fixController(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add RequestHandler import if not exists
    if (!content.includes('RequestHandler')) {
        content = content.replace(/import \{ Request, Response, NextFunction \} from 'express';/, "import { Request, Response, NextFunction, RequestHandler } from 'express';");
    }
    
    // Replace export async function funcName(req: Request, res: Response, next: NextFunction)
    content = content.replace(/export async function (\w+)\(\s*req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\s*\)\s*\{/g, 
        'export const $1: RequestHandler = async (req, res, next) => {');
    
    // Also remove // @ts-nocheck
    content = content.replace(/\/\/ @ts-nocheck\n/g, '');
    
    fs.writeFileSync(file, content, 'utf8');
}

fixController('src/controllers/saleController.ts');
fixController('src/controllers/purchaseController.ts');
fixController('src/controllers/materialController.ts');
fixController('src/controllers/reportController.ts');
console.log('Fixed controllers properly');

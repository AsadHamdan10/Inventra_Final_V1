const { deleteSale } = require('./dist/controllers/saleController');
const { deletePurchase } = require('./dist/controllers/purchaseController');

async function run() {
    console.log('--- RUNNING test_financial_immutability_v2.js ---');
    
    const mockRes = {
        statusCode: 0,
        jsonPayload: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.jsonPayload = data; }
    };
    
    await deleteSale({}, mockRes, () => {});
    
    if (mockRes.statusCode !== 405) {
        console.error(`FAILED: deleteSale returned ${mockRes.statusCode} instead of 405.`);
        process.exit(1);
    }
    
    const mockRes2 = {
        statusCode: 0,
        jsonPayload: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.jsonPayload = data; }
    };
    
    await deletePurchase({}, mockRes2, () => {});
    
    if (mockRes2.statusCode !== 405) {
        console.error(`FAILED: deletePurchase returned ${mockRes2.statusCode} instead of 405.`);
        process.exit(1);
    }
    
    console.log("SUCCESS: Immutability test passed! Hard deletes are prohibited.");
    process.exit(0);
}
run();

const fs = require('fs');
let content = fs.readFileSync('frontend/src/services/apiServices.ts', 'utf8');

// Use simple string replacement for safety
content = content.split('api.put(/inventory/adjustments/${id}, data)').join('api.put(`/inventory/adjustments/${id}`, data)');
content = content.split('api.delete(/inventory/adjustments/${id})').join('api.delete(`/inventory/adjustments/${id}`)');
content = content.split('api.get(/inventory/adjustments/$id)').join('api.get(`/inventory/adjustments/${id}`)');

content = content.split('api.put(/inventory/transfers/${id}, data)').join('api.put(`/inventory/transfers/${id}`, data)');
content = content.split('api.delete(/inventory/transfers/${id})').join('api.delete(`/inventory/transfers/${id}`)');
content = content.split('api.get(/inventory/transfers/$id)').join('api.get(`/inventory/transfers/${id}`)');

content = content.split('api.get(/warehouses/$id)').join('api.get(`/warehouses/${id}`)');
content = content.split('api.put(/warehouses/$id, data)').join('api.put(`/warehouses/${id}`, data)');
content = content.split('api.delete(/warehouses/$id)').join('api.delete(`/warehouses/${id}`)');

content = content.split('api.get(/journals/$id)').join('api.get(`/journals/${id}`)');

fs.writeFileSync('frontend/src/services/apiServices.ts', content);

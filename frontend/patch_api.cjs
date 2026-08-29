const fs = require('fs');
let code = fs.readFileSync('src/services/apiServices.ts', 'utf8');
code += `
export const eWayBillApi = {
  generate: async (sourceType: string, sourceId: number, transportData: any) => {
    const response = await api.post('/ewaybill/generate', { sourceType, sourceId, transportData });
    return response.data;
  },
  cancel: async (id: number, reason: string) => {
    const response = await api.post(\`/ewaybill/\${id}/cancel\`, { reason });
    return response.data;
  },
  updatePartB: async (id: number, transportData: any) => {
    const response = await api.post(\`/ewaybill/\${id}/part-b\`, { transportData });
    return response.data;
  },
  extendValidity: async (id: number, extensionData: any) => {
    const response = await api.post(\`/ewaybill/\${id}/extend\`, { extensionData });
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(\`/ewaybill/\${id}\`);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/ewaybill');
    return response.data;
  },
};
`;
fs.writeFileSync('src/services/apiServices.ts', code);

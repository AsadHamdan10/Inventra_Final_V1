const fs = require('fs');
let content = fs.readFileSync('src/services/apiServices.ts', 'utf8');

// I need to remove the corrupted unicode string. It starts with " e x p o r t " but wait, let's just chop it off manually.
const idx = content.indexOf(' e x p o r t');
if (idx > 0) content = content.substring(0, idx);

content += `
export const gstFilingApi = {
  list: () => api.get('/gst/returns').then((r: any) => r.data),
  get: (id: number) => api.get('/gst/returns/' + id).then((r: any) => r.data),
  prepare: (data: any) => api.post('/gst/returns/prepare', data).then((r: any) => r.data),
  reconcile: (id: number) => api.post('/gst/returns/' + id + '/reconcile').then((r: any) => r.data),
  markReady: (id: number) => api.post('/gst/returns/' + id + '/ready').then((r: any) => r.data),
  file: (id: number, simulateError?: string) => api.post('/gst/returns/' + id + '/file', { simulateError }).then((r: any) => r.data),
  regenerate: (id: number) => api.post('/gst/returns/' + id + '/regenerate').then((r: any) => r.data)
};
`;

fs.writeFileSync('src/services/apiServices.ts', content);

const fs = require('fs');
let s = fs.readFileSync('src/services/apiServices.ts', 'utf8');

// The string was added as utf16le which creates null bytes
s = s.replace(/\x00/g, '');

const cutoff = s.indexOf('export const gstFilingApi = {');
if (cutoff !== -1) {
    s = s.substring(0, cutoff);
} else {
    const cutoff2 = s.indexOf('e x p o r t');
    if (cutoff2 !== -1) s = s.substring(0, cutoff2);
}

s += `
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

fs.writeFileSync('src/services/apiServices.ts', s);

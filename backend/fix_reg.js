const fs = require('fs');

let code = fs.readFileSync('test_registration_security.js', 'utf8');
code = code.replace(
  /adminRes = await reqAuth\('POST', `\/admin\/users\/\$\{createdUser\.id\}\/approve`, superToken\);/g,
  "adminRes = await reqAuth('POST', `/admin/users/${createdUser.id}/approve`, superToken, { plan: 'V1_BASIC', startDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000 * 30).toISOString() });"
);

fs.writeFileSync('test_registration_security.js', code);

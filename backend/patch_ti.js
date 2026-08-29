const fs = require('fs');

let tc = fs.readFileSync('test_cleanup.js', 'utf8');
tc = tc.replace(/const emails = \[.*?\];/, "const emails = ['tenant_a@test.com', 'tenant_b@test.com', 'test_auth@example.com', 'a@test.com', 'b@test.com'];");
fs.writeFileSync('test_cleanup.js', tc);

let ti = fs.readFileSync('test_tenant_isolation.js', 'utf8');
ti = ti.replace(/await prisma\.auditLog\.deleteMany[\s\S]*?await prisma\.user\.deleteMany\(\{ where: \{ username: \{ in: \['tenant_a_test', 'tenant_b_test'\] \} \} \}\);/, 'await cleanupTestUsers();');
fs.writeFileSync('test_tenant_isolation.js', ti);

const fs = require('fs');
const path = require('path');

function scan(dir) {
    let count = 0;
    const files = fs.readdirSync(dir);
    for (const f of files) {
        if (f === 'node_modules' || f === 'dist') continue;
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            count += scan(full);
        } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('@ts-ignore') || content.includes('@ts-nocheck') || content.includes('@ts-expect-error')) {
                console.log('Found bypass in:', full);
                count++;
            }
        }
    }
    return count;
}

const b = scan(path.join(__dirname));
const f = scan(path.join(__dirname, '../frontend'));
console.log('Backend bypasses:', b);
console.log('Frontend bypasses:', f);

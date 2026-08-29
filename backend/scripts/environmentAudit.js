const fs = require('fs');
const path = require('path');

function checkEnv() {
    console.log("=== INVENTRA V1 ENVIRONMENT AUDIT ===");
    
    const envPath = path.join(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
        console.log("[ERROR] .env file not found.");
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    let dbUrl = '';
    let jwtSecret = '';
    let nodeEnv = '';
    
    for (const line of lines) {
        if (line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].replace(/"/g, '');
        if (line.startsWith('JWT_SECRET=')) jwtSecret = line.split('=')[1].replace(/"/g, '');
        if (line.startsWith('NODE_ENV=')) nodeEnv = line.split('=')[1].replace(/"/g, '');
    }

    console.log("NODE_ENV:", nodeEnv || "Not Set");
    
    if (dbUrl) {
        try {
            const url = new URL(dbUrl);
            console.log("Database Host:", url.hostname);
            console.log("Database Name:", url.pathname.replace('/', ''));
            
            if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                console.log("[WARNING] Database host is remote. Verify this is NOT a production database.");
            }
            if (url.pathname.includes('production') || url.pathname.includes('prod')) {
                console.log("[CRITICAL DANGER] Database name indicates production!");
            }
        } catch(e) {
            console.log("[ERROR] Invalid DATABASE_URL format");
        }
    } else {
        console.log("[ERROR] DATABASE_URL missing.");
    }

    if (!jwtSecret) {
        console.log("[WARNING] JWT_SECRET missing.");
    } else if (jwtSecret.length < 32) {
        console.log("[WARNING] JWT_SECRET is dangerously short. Must be at least 32 characters in production.");
    } else if (jwtSecret === 'your_jwt_secret' || jwtSecret === 'secret') {
        console.log("[CRITICAL DANGER] JWT_SECRET is a placeholder.");
    } else {
        console.log("JWT_SECRET: ***[DETECTED]***");
    }

    console.log("=== END OF AUDIT ===");
}

checkEnv();

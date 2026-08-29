const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function run() {
    console.log("=== INVENTRA V1 SUPER ADMIN INITIALIZATION ===");
    console.log("Environment: inventra_v1_development\n");

    rl.question("Enter Super Admin Email: ", async (email) => {
        rl.question("Enter Super Admin Password (will be hashed): ", async (password) => {
            if (!email || !password) {
                console.log("Email and password are required.");
                process.exit(1);
            }

            try {
                const existing = await prisma.user.findFirst({ where: { role: 'super_admin' } });
                if (existing) {
                    console.log("A Super Admin already exists. Resetting password for:", existing.email);
                    const hashed = await bcrypt.hash(password, 10);
                    await prisma.user.update({
                        where: { id: existing.id },
                        data: { passwordHash: hashed }
                    });
                    console.log("Password reset successful.");
                } else {
                    console.log("Creating new Super Admin...");
                    const hashed = await bcrypt.hash(password, 10);
                    await prisma.user.create({
                        data: {
                            email: email,
                            passwordHash: hashed,
                            name: "Super Admin",
                            role: 'super_admin',
                            isActive: true
                        }
                    });
                    console.log("Super Admin created successfully.");
                }
            } catch (err) {
                console.error("Failed:", err);
            } finally {
                await prisma.$disconnect();
                process.exit(0);
            }
        });
    });
}

run();


const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.passwordResetToken.findMany().then(t => console.log(t)).finally(() => prisma.$disconnect());


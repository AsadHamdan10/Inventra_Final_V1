import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function generateToken() {
  const users = await prisma.user.findMany({ take: 1 });
  if (users.length === 0) {
    console.log("No users found");
    process.exit(1);
  }
  const user = users[0];
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tenantId: user.id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  console.log(token);
  process.exit(0);
}
generateToken();

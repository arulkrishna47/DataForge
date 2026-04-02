const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log('Testing DB connection...');
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('Successfully connected to DB:', result);
    const users = await prisma.user.count();
    console.log('User count:', users);
  } catch (err) {
    console.error('DATABASE CONNECTION ERROR:', err.message);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();

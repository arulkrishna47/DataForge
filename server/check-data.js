const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRequests() {
  try {
    const requests = await prisma.serviceRequest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    console.log('--- LATEST 5 SERVICE REQUESTS ---');
    console.log(JSON.stringify(requests, null, 2));
    
    const users = await prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    console.log('\n--- LATEST 5 USERS ---');
    console.log(JSON.stringify(users, null, 2));
    
  } catch (err) {
    console.error('Error fetching data:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRequests();

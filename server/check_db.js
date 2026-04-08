const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('Checking ServiceRequest records...');
  try {
    const count = await prisma.serviceRequest.count();
    const lastRequest = await prisma.serviceRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { email: true } } }
    });
    
    console.log('--- DATABASE STATUS ---');
    console.log('Total Service Requests:', count);
    if (lastRequest) {
      console.log('Latest Request ID:', lastRequest.id);
      console.log('Created At:', lastRequest.createdAt);
      console.log('Client Email:', lastRequest.client.email);
      console.log('Status:', lastRequest.status);
    } else {
      console.log('No requests found in database.');
    }
  } catch (error) {
    console.error('DATABASE ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

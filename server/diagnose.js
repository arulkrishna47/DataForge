require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  try {
    // Test 1: Count service requests
    const reqCount = await p.serviceRequest.count();
    console.log('serviceRequests:', reqCount);

    // Test 2: Count projects
    const projCount = await p.project.count();
    console.log('projects:', projCount);

    // Test 3: Count users by role (uppercase - matches Prisma enum)
    const clientCount = await p.user.count({ where: { role: 'CLIENT' } });
    console.log('users with role=CLIENT:', clientCount);

    const adminCount = await p.user.count({ where: { role: 'ADMIN' } });
    console.log('users with role=ADMIN:', adminCount);

    // Test 4: List all users with roles
    const users = await p.user.findMany({ select: { email: true, role: true } });
    console.log('All users:', JSON.stringify(users));

    // Test 5: List recent service requests
    const reqs = await p.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { client: { select: { email: true } } }
    });
    console.log('Recent requests:', JSON.stringify(reqs, null, 2));

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}
run();

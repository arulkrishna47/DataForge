const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const requests = await prisma.serviceRequest.findMany();
    const projects = await prisma.project.findMany();
    const users = await prisma.user.findMany();
    
    console.log('--- DATABASE STATUS ---');
    console.log('Service Requests:', requests.length);
    requests.forEach(r => console.log(` - ${r.id}: ${r.serviceType} (${r.status})`));
    
    console.log('Projects:', projects.length);
    projects.forEach(p => console.log(` - ${p.id}: ${p.title} (${p.status})`));
    
    console.log('Users:', users.length);
    users.forEach(u => console.log(` - ${u.id}: ${u.email} (${u.role})`));
    
  } catch (err) {
    console.error('DIAGNOSTIC ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();

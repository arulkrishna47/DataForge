require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany().then(users => {
  users.forEach(u => {
    const info = {
      email: u.email,
      role: u.role,
      hasName: !!u.name,
      hasFirstName: !!u.firstName,
      hasPassword: !!u.password,
      isVerified: u.isVerified
    };
    console.log(JSON.stringify(info));
  });
}).catch(e => console.error('ERR:', e.message)).finally(() => p.$disconnect());

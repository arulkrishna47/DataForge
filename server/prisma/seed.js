import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cortexa.ai' },
    update: {},
    create: {
      email: 'admin@cortexa.ai',
      password: hashedPassword,
      firstName: 'Cortexa',
      lastName: 'Master',
      role: 'admin',
    },
  });

  console.log('Seed: Created cortexa master admin user.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

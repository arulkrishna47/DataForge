const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('password123', 10);
  await prisma.user.update({
    where: { email: 'aakashnaveen50@gmail.com' },
    data: { password: hash }
  });
}
main()
  .then(() => console.log('Password updated successfully.'))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

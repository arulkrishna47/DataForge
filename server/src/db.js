const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({ log: ['error', 'warn'] });

module.exports = prisma;

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMigrations() {
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at
    `;
    console.log('Applied migrations:');
    console.log(migrations);
  } catch (error) {
    console.error('Error querying migrations:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrations();
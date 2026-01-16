require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTable() {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    // Try to query GeotaggedMarket
    const count = await prisma.geotaggedMarket.count();
    console.log(`GeotaggedMarket table exists with ${count} records`);
    // Check if there are any records
    const sample = await prisma.geotaggedMarket.findFirst();
    console.log('Sample record:', sample);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'P2021') {
      console.log('Table does not exist');
    } else if (error.code === 'P1001') {
      console.log('Cannot connect to database');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
const { PrismaClient } = require('@prisma/client');

// Override DATABASE_URL with production URL from .env.bak
const productionUrl = 'postgresql://postgres.onwkzqbrmrskazfitshr:Skis4real!09@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionUrl,
    },
  },
});

async function checkProduction() {
  try {
    await prisma.$connect();
    console.log('Connected to production database');
    
    // List tables
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log('Tables in public schema:');
    console.log(tables.map(row => row.tablename).join(', '));
    
    // Check if GeotaggedMarket exists
    const geotaggedExists = tables.some(row => row.tablename === 'GeotaggedMarket');
    console.log(`GeotaggedMarket table exists: ${geotaggedExists}`);
    
    if (geotaggedExists) {
      const count = await prisma.geotaggedMarket.count();
      console.log(`GeotaggedMarket record count: ${count}`);
    } else {
      console.log('GeotaggedMarket missing - this is the cause of the error.');
    }
    
    // Check _prisma_migrations table
    const migrationsExist = tables.some(row => row.tablename === '_prisma_migrations');
    console.log(`_prisma_migrations table exists: ${migrationsExist}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'P1001') {
      console.log('Cannot connect to database');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkProduction();
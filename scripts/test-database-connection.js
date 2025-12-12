// Test database connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Check if DATABASE_URL is set
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('DATABASE_URL: ❌ Missing');
      console.log('\n❌ DATABASE_URL is not set in your .env file!');
      console.log('\n📋 To fix this:');
      console.log('1. Go to Supabase Dashboard → Settings → Database');
      console.log('2. Copy the connection string (Transaction mode)');
      console.log('3. Replace [YOUR-PASSWORD] with your actual password');
      console.log('4. Add to .env: DATABASE_URL=postgresql://postgres:password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres');
      process.exit(1);
    }
    
    console.log('DATABASE_URL: ✅ Set');
    // Mask password in output
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log('Connection string:', maskedUrl);
    
    if (!process.env.DATABASE_URL) {
      console.log('\n❌ DATABASE_URL is not set in your .env file!');
      console.log('\n📋 To fix this:');
      console.log('1. Go to Supabase Dashboard → Settings → Database');
      console.log('2. Copy the connection string (Transaction mode)');
      console.log('3. Replace [YOUR-PASSWORD] with your actual password');
      console.log('4. Add to .env: DATABASE_URL=postgresql://postgres:password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres');
      process.exit(1);
    }

    // Try to connect
    await prisma.$connect();
    console.log('✅ Successfully connected to database!\n');

    // Try a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} user(s) in database`);

    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\n📋 Available tables:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

    console.log('\n✅ Database connection is working!');
  } catch (error) {
    console.error('\n❌ Database connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n🔧 Possible fixes:');
      console.log('1. Check if your Supabase project is active (not paused)');
      console.log('2. Verify DATABASE_URL in .env file is correct');
      console.log('3. Make sure password is URL-encoded if it has special characters');
      console.log('4. Check if your IP is allowed (if IP restrictions are enabled)');
    } else if (error.message.includes('authentication failed')) {
      console.log('\n🔧 Password might be incorrect or not URL-encoded');
      console.log('   Special characters in password need to be encoded:');
      console.log('   @ → %40, # → %23, % → %25, etc.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();


require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

console.log('🔍 Testing Prisma connection...\n');

// Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL not found in process.env!');
  console.log('   Make sure .env file exists and has DATABASE_URL set.\n');
  process.exit(1);
}

// Show connection string (hidden password)
const hiddenUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
console.log(`📋 Connection string: ${hiddenUrl}\n`);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testConnection() {
  try {
    console.log('1. Attempting to connect...');
    
    // Try to connect
    await prisma.$connect();
    console.log('   ✅ Connected successfully!\n');
    
    // Try a simple query
    console.log('2. Testing query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Query successful!\n');
    
    // Check if User table exists
    console.log('3. Checking User table...');
    const userCount = await prisma.user.count();
    console.log(`   ✅ User table exists (${userCount} users)\n`);
    
    // Check test user
    console.log('4. Checking test user...');
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    if (testUser) {
      console.log(`   ✅ Test user found: ${testUser.email}`);
      console.log(`   ✅ Has password: ${testUser.password ? 'Yes' : 'No'}\n`);
    } else {
      console.log('   ⚠️  Test user not found\n');
    }
    
    console.log('✅ All tests passed! Database connection is working.\n');
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n🔍 Troubleshooting:');
      console.log('1. Check if Supabase project is active (not paused)');
      console.log('2. Verify password is correct');
      console.log('3. Check if password has special characters (should be URL-encoded)');
      console.log('4. Try resetting database password in Supabase dashboard');
      console.log('5. Check Supabase status: https://status.supabase.com\n');
    } else if (error.message.includes("password authentication failed")) {
      console.log('\n🔍 Password issue:');
      console.log('1. Password might be incorrect');
      console.log('2. Special characters might need URL encoding');
      console.log('3. Try resetting password in Supabase dashboard\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();




// Test database connection as Next.js would
require('dotenv').config();

console.log('Testing database connection (Next.js style)...\n');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  // Mask password in output
  const masked = url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  console.log('DATABASE_URL:', masked);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function test() {
  try {
    console.log('\nAttempting connection...');
    await prisma.$connect();
    console.log('✅ Database connected!');
    
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    if (user) {
      console.log('✅ Test user found:', user.email);
    } else {
      console.log('⚠️  Test user not found');
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Connection test successful!');
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n💡 Possible solutions:');
      console.log('1. Check if Supabase project is active (not paused)');
      console.log('2. Verify database password is correct');
      console.log('3. Try using connection pooler URL instead');
      console.log('4. Check network/firewall settings');
    }
    
    process.exit(1);
  }
}

test();






const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    console.log('🔍 Testing login functionality...\n');
    
    // Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected\n');
    
    // Find test user
    console.log('2. Finding test user...');
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    if (!user) {
      console.log('   ❌ Test user not found!');
      return;
    }
    
    console.log(`   ✅ User found: ${user.email}`);
    console.log(`   ✅ Has password: ${user.password ? 'Yes' : 'No'}\n`);
    
    if (!user.password) {
      console.log('   ❌ User has no password!');
      return;
    }
    
    // Test password
    console.log('3. Testing password...');
    const testPassword = 'testpassword123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    if (isValid) {
      console.log('   ✅ Password is valid!');
      console.log('\n✅ Login should work with:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${testPassword}\n`);
    } else {
      console.log('   ❌ Password is invalid!');
      console.log('   Generating new password hash...\n');
      
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('   New hash:', newHash);
      console.log('\n   Update the user in database with this hash.\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes("Can't reach database server")) {
      console.log('\n⚠️  DATABASE_URL is not set or incorrect in .env file!');
      console.log('   Run: node scripts/update-database-password.js\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();




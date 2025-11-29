const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyTestUser() {
  try {
    console.log('🔍 Verifying test user...\n');
    
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('❌ Test user not found!');
      return;
    }

    console.log('✅ Test user found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Has password: ${user.password ? 'Yes' : 'No'}\n`);

    if (user.password) {
      const testPassword = 'testpassword123';
      const isValid = await bcrypt.compare(testPassword, user.password);
      
      console.log('🔐 Testing password...');
      console.log(`   Password: ${testPassword}`);
      console.log(`   Hash: ${user.password.substring(0, 20)}...`);
      console.log(`   Valid: ${isValid ? '✅ YES' : '❌ NO'}\n`);

      if (!isValid) {
        console.log('⚠️  Password hash is incorrect!');
        console.log('   Generating new hash...\n');
        
        const newHash = await bcrypt.hash(testPassword, 10);
        console.log('New hash:', newHash);
        console.log('\nUpdate the user with this hash in the database.');
      } else {
        console.log('✅ Password is correct! You can log in with:');
        console.log('   Email: test@example.com');
        console.log('   Password: testpassword123');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestUser();


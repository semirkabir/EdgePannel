// Test login with a known user
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testLogin() {
  try {
    console.log('🔍 Testing login flow...\n');

    // Test credentials
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword123'; // Common test password

    console.log(`Testing login for: ${testEmail}\n`);

    // Try to find user
    console.log('1. Looking up user in database...');
    let user;
    
    try {
      user = await prisma.user.findUnique({
        where: { email: testEmail }
      });
      console.log('   ✅ User found via Prisma findUnique');
    } catch (error) {
      console.log('   ⚠️  Prisma findUnique failed, trying raw SQL...');
      try {
        const users = await prisma.$queryRaw`
          SELECT id, email, name, password, image
          FROM "User"
          WHERE email = ${testEmail}
          LIMIT 1
        `;
        if (users.length > 0) {
          user = users[0];
          console.log('   ✅ User found via raw SQL');
        } else {
          console.log('   ❌ User not found');
        }
      } catch (rawError) {
        console.error('   ❌ Raw SQL also failed:', rawError.message);
        throw rawError;
      }
    }

    if (!user) {
      console.log('\n❌ User not found in database');
      console.log('\n💡 To create a test user, run:');
      console.log('   node scripts/create-test-user-via-api.js');
      process.exit(1);
    }

    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Has password: ${user.password ? 'Yes' : 'No'}\n`);

    if (!user.password) {
      console.log('❌ User has no password set');
      console.log('   This user was likely created via OAuth');
      process.exit(1);
    }

    // Test password verification
    console.log('2. Verifying password...');
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    
    if (isPasswordValid) {
      console.log('   ✅ Password is correct!');
      console.log('\n✅ Login test passed!');
      console.log('\n📋 You can now log in with:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
    } else {
      console.log('   ❌ Password is incorrect');
      console.log('\n💡 The password hash in the database doesn\'t match the test password');
      console.log('   Try registering a new account or resetting the password');
      
      // Show what password was used to create this hash (for debugging)
      console.log('\n🔍 Debugging info:');
      console.log(`   Password hash: ${user.password.substring(0, 20)}...`);
      console.log('   Try different common passwords or check registration logs');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n💡 Database connection failed');
      console.log('   This means Prisma can\'t connect to your Supabase database');
      console.log('   See DATABASE_CONNECTION_FIX.md for help');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

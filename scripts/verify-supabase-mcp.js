// Verify Supabase connection and test user using Prisma
// This simulates what MCP Supabase would check

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function verifySupabase() {
  console.log('🔍 Verifying Supabase Database Connection\n');
  console.log('Project: onwkzqbrmrskazfitshr\n');

  try {
    // 1. Test connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected successfully!\n');

    // 2. Check tables exist
    console.log('2. Checking database tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(`   ✅ Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`      - ${table.table_name}`);
    });
    console.log('');

    // 3. Check test user exists
    console.log('3. Checking test user...');
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (testUser) {
      console.log('   ✅ Test user found!');
      console.log(`      Email: ${testUser.email}`);
      console.log(`      ID: ${testUser.id}`);
      console.log(`      Has password: ${testUser.password ? 'Yes' : 'No'}`);

      if (testUser.password) {
        // Test password
        const isValid = await bcrypt.compare('testpassword123', testUser.password);
        console.log(`      Password valid: ${isValid ? '✅ Yes' : '❌ No'}`);
        
        if (!isValid) {
          console.log('\n   ⚠️  Password hash needs to be updated!');
          const newHash = await bcrypt.hash('testpassword123', 10);
          console.log('   New hash generated. Update user in database with:');
          console.log(`   ${newHash}`);
        }
      } else {
        console.log('   ⚠️  Test user has no password!');
      }
    } else {
      console.log('   ❌ Test user not found!');
      console.log('   Creating test user...');
      
      const hashedPassword = await bcrypt.hash('testpassword123', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        }
      });
      console.log('   ✅ Test user created!');
      console.log(`      Email: ${newUser.email}`);
      console.log(`      ID: ${newUser.id}`);
    }

    console.log('\n✅ All checks passed!');
    console.log('\n📝 Test credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: testpassword123');
    console.log('\n🚀 You can now restart your dev server and test login!');

  } catch (error) {
    console.error('\n❌ Verification failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n💡 Database connection issue:');
      console.log('1. Check if Supabase project is active (not paused)');
      console.log('2. Verify DATABASE_URL in .env file');
      console.log('3. Make sure password is URL-encoded if it has special characters');
      console.log('4. Try using direct connection (port 5432) instead of pooler');
    } else if (error.message.includes("password authentication failed")) {
      console.log('\n💡 Password authentication issue:');
      console.log('1. Verify the database password is correct');
      console.log('2. Make sure special characters are URL-encoded');
      console.log('3. Try resetting the password in Supabase Dashboard');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySupabase();






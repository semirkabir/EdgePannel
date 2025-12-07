// Create test user via the registration API endpoint
// This works even without SUPABASE_SERVICE_ROLE_KEY if the endpoint handles it

const testEmail = 'test@example.com';
const testPassword = 'testpassword123';
const testName = 'Test User';

async function createTestUserViaAPI() {
  try {
    console.log('🔐 Creating test user via registration API...\n');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Name: ${testName}\n`);

    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error?.includes('already exists') || data.error?.includes('already registered')) {
        console.log('⚠️  Test user already exists!');
        console.log('\n📋 You can use these credentials to log in:');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
        console.log('\n✅ The user should be visible in Supabase Dashboard → Authentication → Users');
        return;
      }
      throw new Error(data.error || 'Failed to create user');
    }

    console.log('✅ Test user created successfully!');
    console.log('\n📋 Test Account Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Name: ${testName}`);
    if (data.supabaseUserId) {
      console.log(`   Supabase User ID: ${data.supabaseUserId}`);
    }
    console.log('\n✅ You can now:');
    console.log('1. View this user in Supabase Dashboard → Authentication → Users');
    console.log('2. Log in at http://localhost:3000/login');
    console.log('\n🚀 Make sure your dev server is running: npm run dev');

  } catch (error) {
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('❌ Error: Could not connect to the server');
      console.log('\n💡 Make sure your dev server is running:');
      console.log('   1. Run: npm run dev');
      console.log('   2. Wait for the server to start');
      console.log('   3. Run this script again\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

createTestUserViaAPI();


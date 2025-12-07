const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://onwkzqbrmrskazfitshr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test user credentials
const testEmail = 'test@example.com';
const testPassword = 'testpassword123';
const testName = 'Test User';

async function createTestUser() {
  try {
    if (!supabaseServiceRoleKey) {
      console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env file');
      console.log('\n📝 To create a test user:');
      console.log('1. Go to Supabase Dashboard → Settings → API');
      console.log('2. Copy the "service_role" key');
      console.log('3. Add it to your .env file as: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
      console.log('4. Run this script again\n');
      process.exit(1);
    }

    console.log('🔐 Creating test user in Supabase Auth...\n');

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email === testEmail);
    
    if (existingUser) {
      console.log(`⚠️  User with email ${testEmail} already exists!`);
      console.log(`   User ID: ${existingUser.id}`);
      console.log('\n📝 To use this account:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      console.log('\n💡 If you want to reset the password, delete the user in Supabase Dashboard first.');
      return;
    }

    // Create user in Supabase Auth
    console.log('✨ Creating new user in Supabase Auth...');
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: testName,
      },
    });

    if (authError) {
      console.error('❌ Error creating user:', authError.message);
      throw authError;
    }

    if (!authUser?.user) {
      throw new Error('Failed to create user - no user data returned');
    }

    console.log('✅ Test user created successfully in Supabase Auth!');
    console.log('\n📋 Test Account Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Name: ${testName}`);
    console.log(`   User ID: ${authUser.user.id}`);
    console.log('\n✅ You can now:');
    console.log('1. View this user in Supabase Dashboard → Authentication → Users');
    console.log('2. Log in at http://localhost:3000/login');
    console.log('3. The user will also be created in Prisma on first login\n');

  } catch (error) {
    console.error('\n❌ Failed to create test user:', error.message);
    if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
      console.log('\n💡 The user already exists. You can:');
      console.log('1. Use the existing account to log in');
      console.log('2. Delete the user in Supabase Dashboard and run this script again');
    }
    process.exit(1);
  }
}

createTestUser();


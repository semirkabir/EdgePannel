// Test the full authentication flow using Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://onwkzqbrmrskazfitshr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testAuthFlow() {
  console.log('🔍 Testing Full Authentication Flow...\n');

  // Test with a known user
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123'; // Common test password

  try {
    console.log(`1. Looking up user: ${testEmail}`);
    const { data: user, error: queryError } = await supabaseAdmin
      .from('User')
      .select('id, email, name, password, image')
      .eq('email', testEmail)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error(`   ❌ Query failed: ${queryError.message}`);
      process.exit(1);
    }

    if (!user) {
      console.log('   ❌ User not found');
      console.log('\n💡 Available users:');
      const { data: allUsers } = await supabaseAdmin
        .from('User')
        .select('email, name')
        .limit(5);
      allUsers?.forEach(u => console.log(`   - ${u.email}`));
      process.exit(1);
    }

    console.log(`   ✅ User found: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);

    if (!user.password) {
      console.log('   ❌ User has no password');
      process.exit(1);
    }

    console.log(`   ✅ User has password hash`);

    console.log('\n2. Testing password verification...');
    console.log(`   Testing password: ${testPassword}`);
    
    // Try common test passwords
    const testPasswords = [
      'testpassword123',
      'TestPassword123',
      'password123',
      'Password123',
    ];

    let passwordMatched = false;
    for (const pwd of testPasswords) {
      const isValid = await bcrypt.compare(pwd, user.password);
      if (isValid) {
        console.log(`   ✅ Password matched: ${pwd}`);
        passwordMatched = true;
        break;
      }
    }

    if (!passwordMatched) {
      console.log('   ❌ None of the test passwords matched');
      console.log('\n💡 The password hash doesn\'t match common test passwords');
      console.log('   You may need to:');
      console.log('   1. Register a new account with a known password');
      console.log('   2. Or reset the password for this user');
      console.log('   3. Or check what password was used during registration');
    }

    console.log('\n3. Testing Supabase Auth (alternative method)...');
    const supabaseAnon = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2t6cWJybXJza2F6Zml0c2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjEzMjgsImV4cCI6MjA3OTkzNzMyOH0.x71N9NtBo0QoRC52AyNUpCfTacuVP60BhJ4HhLW0R84'
    );

    // Note: This will fail if user wasn't created via Supabase Auth
    // But that's okay - we have the bcrypt method working
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      console.log(`   ⚠️  Supabase Auth failed: ${authError.message}`);
      console.log('   This is normal if user was created via Prisma/registration API');
    } else {
      console.log('   ✅ Supabase Auth successful!');
    }

    console.log('\n✅ Authentication Flow Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Supabase Connection: ✅ Working`);
    console.log(`   - User Lookup: ✅ Working`);
    console.log(`   - Password Hash: ✅ Present`);
    console.log(`   - Password Verification: ${passwordMatched ? '✅ Working' : '❌ Need correct password'}`);
    console.log(`   - Supabase Auth: ${authError ? '⚠️  Not available (user not in Supabase Auth)' : '✅ Working'}`);

    if (passwordMatched) {
      console.log('\n🎉 Login should work! Try logging in with:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: (the one that matched)`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAuthFlow();




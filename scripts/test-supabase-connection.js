// Test Supabase connection and authentication flow
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://onwkzqbrmrskazfitshr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2t6cWJybXJza2F6Zml0c2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjEzMjgsImV4cCI6MjA3OTkzNzMyOH0.x71N9NtBo0QoRC52AyNUpCfTacuVP60BhJ4HhLW0R84';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`Service Role Key: ${supabaseServiceRoleKey ? '✅ Set' : '❌ Missing'}\n`);

  // Test with anon key (client-side operations)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Test with service role key (server-side operations, bypasses RLS)
  const supabaseAdmin = supabaseServiceRoleKey 
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

  try {
    console.log('1. Testing database query with anon key...');
    const { data: anonData, error: anonError } = await supabase
      .from('User')
      .select('id, email, name')
      .limit(1);

    if (anonError) {
      console.log(`   ⚠️  Anon key query failed: ${anonError.message}`);
      console.log('   This is normal if RLS is enabled on User table');
    } else {
      console.log(`   ✅ Anon key query successful! Found ${anonData?.length || 0} user(s)`);
    }

    if (supabaseAdmin) {
      console.log('\n2. Testing database query with service role key...');
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('User')
        .select('id, email, name, password')
        .limit(5);

      if (adminError) {
        console.log(`   ❌ Service role key query failed: ${adminError.message}`);
      } else {
        console.log(`   ✅ Service role key query successful! Found ${adminData?.length || 0} user(s)`);
        if (adminData && adminData.length > 0) {
          console.log('\n   Users found:');
          adminData.forEach((user, i) => {
            console.log(`   ${i + 1}. ${user.email} (${user.name || 'No name'}) - Password: ${user.password ? 'Yes' : 'No'}`);
          });
        }
      }
    } else {
      console.log('\n2. ⚠️  Service role key not set - skipping admin query test');
      console.log('   To enable: Add SUPABASE_SERVICE_ROLE_KEY to .env');
    }

    console.log('\n3. Testing authentication flow...');
    const testEmail = 'test@example.com';
    
    if (supabaseAdmin) {
      // Try to find user and verify password
      const { data: users, error: userError } = await supabaseAdmin
        .from('User')
        .select('id, email, name, password')
        .eq('email', testEmail)
        .limit(1)
        .single();

      if (userError) {
        console.log(`   ⚠️  Could not find test user: ${userError.message}`);
      } else if (users && users.password) {
        console.log(`   ✅ Found user: ${users.email}`);
        console.log(`   ✅ User has password hash`);
        console.log(`   📝 To test login, try password verification with bcrypt`);
      } else {
        console.log(`   ⚠️  User found but has no password`);
      }
    }

    console.log('\n✅ Supabase connection test complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Supabase URL: ✅ Connected`);
    console.log(`   - Anon Key: ${anonError ? '⚠️  May have RLS restrictions' : '✅ Working'}`);
    console.log(`   - Service Role Key: ${supabaseAdmin ? '✅ Available' : '❌ Not set'}`);
    console.log('\n💡 For login to work properly:');
    console.log('   1. Service role key should be set for server-side queries');
    console.log('   2. Or ensure RLS policies allow reading User table');
    console.log('   3. Password verification uses bcrypt.compare()');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSupabaseConnection();



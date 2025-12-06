require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

console.log('🔍 Checking your database connection string...\n');

// Check connection type
if (dbUrl.includes('pooler.supabase.com')) {
  console.log('❌ You are using the CONNECTION POOLER URL (port 6543)');
  console.log('   This is for application connections, NOT for Prisma migrations!\n');
  console.log('✅ You need the DIRECT CONNECTION URL (port 5432)\n');
  console.log('📝 How to fix:');
  console.log('   1. Go to Supabase Dashboard → Settings → Database');
  console.log('   2. Under "Connection string", select "Transaction" mode');
  console.log('   3. Copy that connection string (uses port 5432)');
  console.log('   4. Update your .env file\n');
} else if (dbUrl.includes('db.') && dbUrl.includes(':5432')) {
  console.log('✅ You are using the DIRECT CONNECTION URL (port 5432)');
  console.log('   This is correct for Prisma migrations!\n');
  
  // Check if password is replaced
  if (dbUrl.includes('[YOUR-PASSWORD]') || dbUrl.includes('YOUR-PASSWORD')) {
    console.log('⚠️  WARNING: Password placeholder found!');
    console.log('   Make sure you replaced [YOUR-PASSWORD] with your actual password\n');
  } else {
    console.log('✅ Password appears to be set (no placeholder found)');
  }
} else {
  console.log('⚠️  Unknown connection string format');
  console.log('   Make sure you\'re using a Supabase connection string\n');
}

console.log('Current DATABASE_URL format:');
console.log(dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password



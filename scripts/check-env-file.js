const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔍 Checking .env file and environment variables...\n');

const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  process.exit(1);
}

console.log('✅ .env file exists\n');

// Read .env file content
const envContent = fs.readFileSync(envPath, 'utf8');

// Check for DATABASE_URL
console.log('📋 DATABASE_URL in .env file:');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (dbUrlMatch) {
  const dbUrl = dbUrlMatch[1].trim();
  // Hide password
  const hiddenUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`   ${hiddenUrl}`);
  
  // Check for common issues
  if (dbUrl.includes('[YOUR-PASSWORD]')) {
    console.log('\n❌ ERROR: [YOUR-PASSWORD] placeholder still present!');
    console.log('   Run: node scripts/update-database-password.js\n');
  } else if (dbUrl.includes('localhost')) {
    console.log('\n⚠️  WARNING: Using localhost - should use Supabase URL');
  } else {
    console.log('   ✅ Format looks correct');
  }
} else {
  console.log('   ❌ DATABASE_URL not found in .env file!');
}

// Check environment variable (what Node.js sees)
console.log('\n📋 DATABASE_URL from process.env:');
if (process.env.DATABASE_URL) {
  const hiddenEnv = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`   ${hiddenEnv}`);
  console.log('   ✅ Environment variable is set');
} else {
  console.log('   ❌ Environment variable not set!');
  console.log('   This means dotenv is not loading the .env file properly.');
}

// Check other required vars
console.log('\n📋 Other environment variables:');
console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`   ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || '❌ Missing'}`);

console.log('\n💡 If DATABASE_URL is in .env but not in process.env,');
console.log('   make sure you have dotenv installed: npm install dotenv\n');


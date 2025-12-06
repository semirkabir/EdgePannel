const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Setting up .env file with Supabase MCP information...\n');

// Supabase project details (from MCP)
const projectRef = 'onwkzqbrmrskazfitshr';
const projectUrl = `https://${projectRef}.supabase.co`;

console.log(`✅ Supabase Project: ${projectRef}`);
console.log(`✅ Project URL: ${projectUrl}\n`);

const envPath = path.join(process.cwd(), '.env');

// Generate secrets if needed
const generateSecret = () => crypto.randomBytes(32).toString('base64');

// Read existing .env or start fresh
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📝 Found existing .env file, updating...\n');
} else {
  console.log('📝 Creating new .env file...\n');
}

// Build the .env content
const envVars = {
  'DATABASE_URL': envContent.match(/DATABASE_URL=(.+)/)?.[1] || `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`,
  'NEXTAUTH_SECRET': envContent.match(/NEXTAUTH_SECRET=(.+)/)?.[1] || generateSecret(),
  'NEXTAUTH_URL': envContent.match(/NEXTAUTH_URL=(.+)/)?.[1] || 'http://localhost:3000',
  'ENCRYPTION_KEY': envContent.match(/ENCRYPTION_KEY=(.+)/)?.[1] || generateSecret(),
  'POLYMARKET_API_KEY': envContent.match(/POLYMARKET_API_KEY=(.+)/)?.[1] || '',
  'GOOGLE_CLIENT_ID': envContent.match(/GOOGLE_CLIENT_ID=(.+)/)?.[1] || '',
  'GOOGLE_CLIENT_SECRET': envContent.match(/GOOGLE_CLIENT_SECRET=(.+)/)?.[1] || '',
  'GITHUB_CLIENT_ID': envContent.match(/GITHUB_CLIENT_ID=(.+)/)?.[1] || '',
  'GITHUB_CLIENT_SECRET': envContent.match(/GITHUB_CLIENT_SECRET=(.+)/)?.[1] || '',
};

// Build the .env file content
let newEnvContent = `# Database (Supabase)
# ⚠️  IMPORTANT: Replace [YOUR-PASSWORD] with your actual Supabase database password
DATABASE_URL=${envVars.DATABASE_URL}

# NextAuth
NEXTAUTH_SECRET=${envVars.NEXTAUTH_SECRET}
NEXTAUTH_URL=${envVars.NEXTAUTH_URL}

# Encryption (for API key encryption)
ENCRYPTION_KEY=${envVars.ENCRYPTION_KEY}

# Polymarket (optional - for server-side proxy if needed)
POLYMARKET_API_KEY=${envVars.POLYMARKET_API_KEY}

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=${envVars.GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${envVars.GOOGLE_CLIENT_SECRET}
GITHUB_CLIENT_ID=${envVars.GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${envVars.GITHUB_CLIENT_SECRET}
`;

// Write to file
fs.writeFileSync(envPath, newEnvContent);

console.log('✅ .env file created/updated!\n');
console.log('📋 What was set:');
console.log(`   ✅ DATABASE_URL (needs password - see below)`);
console.log(`   ✅ NEXTAUTH_SECRET: ${envVars.NEXTAUTH_SECRET.substring(0, 20)}...`);
console.log(`   ✅ ENCRYPTION_KEY: ${envVars.ENCRYPTION_KEY.substring(0, 20)}...`);
console.log(`   ✅ NEXTAUTH_URL: ${envVars.NEXTAUTH_URL}\n`);

if (envVars.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
  console.log('⚠️  ACTION REQUIRED:\n');
  console.log('1. Open your .env file');
  console.log('2. Find DATABASE_URL');
  console.log('3. Replace [YOUR-PASSWORD] with your Supabase database password');
  console.log('4. If password has special characters (@, #, %, etc.), they will be auto-encoded\n');
  console.log('Or run this to update it automatically:');
  console.log('   node scripts/fix-database-url.js\n');
} else {
  console.log('✅ DATABASE_URL is already set!\n');
}

console.log('🚀 You can now start your dev server:');
console.log('   npm run dev\n');



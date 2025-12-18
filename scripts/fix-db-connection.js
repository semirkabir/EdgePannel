const fs = require('fs');
const path = require('path');
require('dotenv').config();

const envPath = path.join(process.cwd(), '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Extract current DATABASE_URL
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.log('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const currentUrl = dbUrlMatch[1].trim();
console.log('Current DATABASE_URL:', currentUrl.substring(0, 50) + '...\n');

// Extract password from URL
const urlMatch = currentUrl.match(/postgresql:\/\/postgres:(.+)@/);
if (!urlMatch) {
  console.log('❌ Could not parse DATABASE_URL');
  process.exit(1);
}

const password = decodeURIComponent(urlMatch[1]);
console.log('Password extracted:', password);

// Re-encode the password properly
const encodedPassword = encodeURIComponent(password);
const projectRef = 'onwkzqbrmrskazfitshr';
const newUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

// Update .env
envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${newUrl}`);
fs.writeFileSync(envPath, envContent);

console.log('\n✅ DATABASE_URL updated with properly encoded password');
console.log('Testing connection...\n');

// Test connection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return prisma.user.findUnique({ where: { email: 'test@example.com' } });
  })
  .then(user => {
    if (user) {
      console.log('✅ Test user found:', user.email);
      console.log('✅ Has password:', user.password ? 'Yes' : 'No');
    } else {
      console.log('⚠️  Test user not found - you may need to create it');
    }
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('\n✅ All checks passed! You can now restart your dev server.');
  })
  .catch(err => {
    console.error('\n❌ Connection error:', err.message);
    if (err.message.includes("Can't reach database server")) {
      console.log('\nPossible issues:');
      console.log('1. Check if your Supabase project is active');
      console.log('2. Verify the database password is correct');
      console.log('3. Check your network/firewall settings');
    }
    process.exit(1);
  });













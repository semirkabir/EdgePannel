// Fix DATABASE_URL with proper pooler connection
const fs = require('fs');
const path = require('path');

const password = 'Skis4real!09';
const encodedPassword = encodeURIComponent(password);
const projectRef = 'onwkzqbrmrskazfitshr';

// Use connection pooler (port 6543) - more reliable for applications
const poolerUrl = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;

const envPath = path.join(process.cwd(), '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Update DATABASE_URL
if (envContent.includes('DATABASE_URL=')) {
  envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${poolerUrl}`);
} else {
  envContent += `\nDATABASE_URL=${poolerUrl}\n`;
}

fs.writeFileSync(envPath, envContent);

console.log('✅ DATABASE_URL updated to connection pooler (port 6543)');
console.log('   This is more reliable for Prisma connections\n');

// Test connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return prisma.user.count();
  })
  .then(count => {
    console.log(`✅ Found ${count} user(s) in database`);
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('\n✅ Everything is configured correctly!');
    console.log('🚀 Restart your dev server: npm run dev');
  })
  .catch(err => {
    console.error('\n❌ Connection still failing:', err.message);
    console.log('\n💡 Troubleshooting steps:');
    console.log('1. Check Supabase Dashboard → Settings → Database');
    console.log('2. Verify your database password is correct');
    console.log('3. Check if your Supabase project is active (not paused)');
    console.log('4. Try resetting your database password in Supabase');
    console.log('5. Check if IP restrictions are enabled (disable for testing)');
    process.exit(1);
  });




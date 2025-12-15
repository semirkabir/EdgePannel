// Update DATABASE_URL to direct connection format (port 5432) with proper encoding
const fs = require('fs');
const path = require('path');

const password = 'Skis4real!09';
const encodedPassword = encodeURIComponent(password);
const projectRef = 'onwkzqbrmrskazfitshr';

// Direct connection format (recommended for Prisma)
const directUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

const envPath = path.join(process.cwd(), '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Update DATABASE_URL
envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${directUrl}`);
fs.writeFileSync(envPath, envContent);

console.log('✅ DATABASE_URL updated to direct connection format');
console.log(`   Format: postgresql://postgres:****@db.${projectRef}.supabase.co:5432/postgres\n`);

// Test connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Testing connection...\n');

prisma.$connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return prisma.$queryRaw`SELECT version()`;
  })
  .then(() => {
    console.log('✅ Database query successful!');
    return prisma.user.findUnique({ where: { email: 'test@example.com' } });
  })
  .then(user => {
    if (user) {
      console.log('✅ Test user exists:', user.email);
    } else {
      console.log('⚠️  Test user not found (will be created on first registration)');
    }
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('\n✅ Everything is configured correctly!');
    console.log('🚀 Restart your dev server: npm run dev');
    console.log('📝 Then try logging in with: test@example.com / testpassword123');
  })
  .catch(err => {
    console.error('\n❌ Connection failed:', err.message);
    console.log('\n💡 Please check:');
    console.log('1. Supabase project is active (not paused)');
    console.log('2. Database password is correct');
    console.log('3. Network allows connections to Supabase');
    console.log('\nGet the correct connection string from:');
    console.log('   Supabase Dashboard → Settings → Database → Connection string');
    process.exit(1);
  });






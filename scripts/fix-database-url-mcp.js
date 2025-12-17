// Fix DATABASE_URL with proper encoding for Supabase MCP project
const fs = require('fs');
const path = require('path');

const password = 'Skis4real!09';
const encodedPassword = encodeURIComponent(password);
const projectRef = 'onwkzqbrmrskazfitshr';

// Try direct connection first (port 5432)
const directUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

// Also prepare pooler URL as backup
const poolerUrl = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const envPath = path.join(process.cwd(), '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Update with direct connection (most reliable for Prisma)
envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${directUrl}`);
fs.writeFileSync(envPath, envContent);

console.log('✅ DATABASE_URL updated with properly encoded password');
console.log('   Using direct connection (port 5432)\n');

// Test connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return prisma.user.findUnique({ where: { email: 'test@example.com' } });
  })
  .then(user => {
    if (user) {
      console.log('✅ Test user exists:', user.email);
    } else {
      console.log('⚠️  Test user not found - will be created on first login');
    }
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('\n✅ Everything is configured correctly!');
    console.log('🚀 Restart your dev server and try logging in.');
  })
  .catch(err => {
    console.error('\n❌ Connection still failing:', err.message);
    console.log('\n💡 Trying pooler connection as backup...\n');
    
    // Try pooler
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${poolerUrl}`);
    fs.writeFileSync(envPath, envContent);
    
    console.log('Updated to pooler URL. Please check:');
    console.log('1. Supabase project is active (not paused)');
    console.log('2. Database password is correct');
    console.log('3. Network allows connections to Supabase');
    process.exit(1);
  });












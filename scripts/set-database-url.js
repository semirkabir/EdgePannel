const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const password = 'Skis4real!09';
const encodedPassword = encodeURIComponent(password);
const projectRef = 'onwkzqbrmrskazfitshr';
const databaseUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Update DATABASE_URL
if (envContent.includes('DATABASE_URL=')) {
  envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
} else {
  envContent += `\nDATABASE_URL=${databaseUrl}\n`;
}

// Write back
fs.writeFileSync(envPath, envContent);

console.log('✅ DATABASE_URL updated successfully!');
console.log(`   Connection: postgresql://postgres:****@db.${projectRef}.supabase.co:5432/postgres\n`);

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
      console.log('✅ Test user found:', user.email);
    } else {
      console.log('⚠️  Test user not found - you may need to create it');
    }
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('\n✅ Ready to test login! Restart your dev server.');
  })
  .catch(err => {
    console.error('\n❌ Connection error:', err.message);
    console.log('\n⚠️  Please check:');
    console.log('1. Your Supabase project is active');
    console.log('2. The database password is correct');
    console.log('3. Your network allows connections to Supabase');
    process.exit(1);
  });












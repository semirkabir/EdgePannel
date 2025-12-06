const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const projectRef = 'onwkzqbrmrskazfitshr';
const envPath = path.join(process.cwd(), '.env');

console.log('🔧 Fix Password Encoding in DATABASE_URL\n');
console.log('This will properly URL-encode your password.\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  rl.close();
  return;
}

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Extract current DATABASE_URL to show
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (dbUrlMatch) {
  const currentUrl = dbUrlMatch[1].trim();
  console.log('Current DATABASE_URL:');
  console.log(`  ${currentUrl.replace(/:[^:@]+@/, ':****@')}\n`);
}

rl.question('Enter your Supabase database password (will be URL-encoded): ', (password) => {
  // URL encode the password properly
  const encodedPassword = encodeURIComponent(password);
  
  console.log('\n📋 Encoding details:');
  console.log(`   Original: ${password}`);
  console.log(`   Encoded:  ${encodedPassword}`);
  
  // Show what characters were encoded
  if (password !== encodedPassword) {
    console.log('\n   Special characters were encoded:');
    const specialChars = password.match(/[@#%&+\/=]/g);
    if (specialChars) {
      specialChars.forEach(char => {
        const encoded = encodeURIComponent(char);
        console.log(`     ${char} → ${encoded}`);
      });
    }
  }
  
  // Create the connection string
  const databaseUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  
  // Update .env
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
  } else {
    envContent += `\nDATABASE_URL=${databaseUrl}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ DATABASE_URL updated with properly encoded password!');
  console.log(`   Connection: postgresql://postgres:****@db.${projectRef}.supabase.co:5432/postgres\n`);
  console.log('🧪 Testing connection...\n');
  
  // Test the connection
  require('dotenv').config({ override: true });
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => {
      console.log('✅ Connection successful!');
      return prisma.$disconnect();
    })
    .then(() => {
      console.log('\n🚀 You can now restart your dev server and test login!\n');
      rl.close();
    })
    .catch((error) => {
      console.error('❌ Connection still failing:', error.message);
      console.log('\n💡 Possible issues:');
      console.log('   1. Password might be incorrect');
      console.log('   2. Supabase project might be paused');
      console.log('   3. Network/firewall blocking connection');
      console.log('   4. Try resetting password in Supabase dashboard\n');
      rl.close();
    });
});



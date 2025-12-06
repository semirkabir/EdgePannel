const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const projectRef = 'onwkzqbrmrskazfitshr';
const envPath = path.join(process.cwd(), '.env');

console.log('🔧 Update Database Password in .env\n');
console.log(`Supabase Project: ${projectRef}\n`);

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('Run: node scripts/setup-env-with-supabase.js\n');
  rl.close();
  return;
}

rl.question('Enter your Supabase database password: ', (password) => {
  // Read current .env
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // URL encode the password
  const encodedPassword = encodeURIComponent(password);
  
  // Create the connection string
  const databaseUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  
  // Update DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
  } else {
    envContent += `\nDATABASE_URL=${databaseUrl}\n`;
  }
  
  // Write back
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ DATABASE_URL updated successfully!');
  console.log(`   Connection: postgresql://postgres:****@db.${projectRef}.supabase.co:5432/postgres\n`);
  console.log('🚀 You can now restart your dev server and test login!\n');
  
  rl.close();
});



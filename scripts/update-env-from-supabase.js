const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Updating .env file with Supabase connection...\n');

// Supabase project details
const projectRef = 'onwkzqbrmrskazfitshr';
const projectUrl = `https://${projectRef}.supabase.co`;

console.log(`Project Reference: ${projectRef}`);
console.log(`Project URL: ${projectUrl}\n`);

rl.question('Enter your Supabase database password: ', (password) => {
  // URL encode the password
  const encodedPassword = encodeURIComponent(password);
  
  // Create the connection string
  const databaseUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env or create new
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    // Replace existing DATABASE_URL
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
  } else {
    // Add DATABASE_URL if it doesn't exist
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `DATABASE_URL=${databaseUrl}\n`;
  }
  
  // Ensure NEXTAUTH_SECRET exists
  if (!envContent.includes('NEXTAUTH_SECRET=')) {
    const crypto = require('crypto');
    const nextAuthSecret = crypto.randomBytes(32).toString('base64');
    envContent += `NEXTAUTH_SECRET=${nextAuthSecret}\n`;
  }
  
  // Ensure ENCRYPTION_KEY exists
  if (!envContent.includes('ENCRYPTION_KEY=')) {
    const crypto = require('crypto');
    const encryptionKey = crypto.randomBytes(32).toString('base64');
    envContent += `ENCRYPTION_KEY=${encryptionKey}\n`;
  }
  
  // Ensure NEXTAUTH_URL exists
  if (!envContent.includes('NEXTAUTH_URL=')) {
    envContent += `NEXTAUTH_URL=http://localhost:3000\n`;
  }
  
  // Write to .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ .env file updated successfully!\n');
  console.log('Updated/Added:');
  console.log(`  - DATABASE_URL=${databaseUrl.substring(0, 50)}...`);
  console.log('  - NEXTAUTH_SECRET (if missing)');
  console.log('  - ENCRYPTION_KEY (if missing)');
  console.log('  - NEXTAUTH_URL (if missing)\n');
  console.log('You can now restart your dev server!\n');
  
  rl.close();
});




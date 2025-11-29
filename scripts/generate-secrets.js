const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate random secrets
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
const encryptionKey = crypto.randomBytes(32).toString('base64');

console.log('\n🔐 Generated Secrets:\n');
console.log('NEXTAUTH_SECRET=' + nextAuthSecret);
console.log('ENCRYPTION_KEY=' + encryptionKey);
console.log('\n📝 Add these to your .env file\n');

// Check if .env exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Creating .env.example template...\n');
  
  const envTemplate = `# Database
DATABASE_URL=

# NextAuth
NEXTAUTH_SECRET=${nextAuthSecret}
NEXTAUTH_URL=http://localhost:3000

# Encryption (for API key encryption)
ENCRYPTION_KEY=${encryptionKey}

# Polymarket (optional - for server-side proxy if needed)
POLYMARKET_API_KEY=

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
`;

  fs.writeFileSync(envExamplePath, envTemplate);
  console.log('✅ Created .env.example with generated secrets');
  console.log('📋 Copy .env.example to .env and fill in your DATABASE_URL\n');
} else {
  console.log('✅ .env file exists. Add the secrets above to it.\n');
}


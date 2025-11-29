const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...\n');
    await prisma.$connect();
    console.log('✅ Successfully connected to database!');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Database query successful!');
    console.log('Database version:', result[0]?.version || 'Unknown');
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n🔍 Troubleshooting tips:');
      console.log('1. Check your DATABASE_URL in .env file');
      console.log('2. Make sure you replaced [YOUR-PASSWORD] with your actual password');
      console.log('3. Verify your Supabase project is active');
      console.log('4. Check if your IP needs to be whitelisted in Supabase');
      console.log('5. Try using the "Connection pooling" URL instead');
    }
    
    if (error.message.includes("password authentication failed")) {
      console.log('\n🔍 Password issue:');
      console.log('1. Make sure you replaced [YOUR-PASSWORD] in the connection string');
      console.log('2. Check for special characters - you may need to URL encode them');
      console.log('3. Try resetting your database password in Supabase');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();


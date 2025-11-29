const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkApiKeys() {
  try {
    console.log('🔍 Checking API keys for test user...\n');

    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id }
    });

    console.log(`Found ${keys.length} API keys for user ${user.email}:`);
    keys.forEach(key => {
      console.log(`  - Platform: ${key.platform}`);
      console.log(`    Has encrypted key: ${!!key.encryptedKey}`);
      console.log(`    Has encrypted key data: ${!!key.encryptedKeyData}`);
      console.log(`    Is active: ${key.isActive}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkApiKeys();
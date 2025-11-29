const { PrismaClient } = require('@prisma/client');

// Since Next.js compiles TS at runtime, let's try importing from source
// If this fails, we'll need to build first
let KalshiClient, PolymarketClient, decrypt;
try {
  ({ KalshiClient } = require('../lib/api/kalshi'));
  ({ PolymarketClient } = require('../lib/api/polymarket'));
  ({ decrypt } = require('../lib/utils/encryption'));
} catch (e) {
  console.log('Could not import from source, trying to build first...');
  // We'll handle this below
}

const prisma = new PrismaClient();

async function testApiClients() {
  try {
    console.log('🔍 Testing API clients directly...\n');

    // Get test user
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    console.log(`Found user: ${user.email} (ID: ${user.id})\n`);

    // Test Kalshi
    console.log('=== Testing Kalshi Client ===');
    const kalshiKey = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: 'kalshi'
        }
      }
    });

    if (kalshiKey && kalshiKey.encryptedKeyData) {
      try {
        const accessKeyId = decrypt(kalshiKey.encryptedKey);
        const privateKey = decrypt(kalshiKey.encryptedKeyData);

        console.log('✅ Kalshi keys decrypted successfully');
        console.log(`Access Key ID: ${accessKeyId.substring(0, 8)}...`);

        const kalshiClient = new KalshiClient({ accessKeyId, privateKey });
        console.log('🔄 Calling Kalshi getMarkets...');

        const markets = await kalshiClient.getMarkets({ limit: 5 });
        console.log(`✅ Kalshi returned ${markets.length} markets`);

      } catch (error) {
        console.log('❌ Kalshi client error:', error.message);
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
      }
    } else {
      console.log('❌ No Kalshi API keys found');
    }

    console.log('\n=== Testing Polymarket Client ===');

    // Test Polymarket
    const polymarketKey = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: 'polymarket'
        }
      }
    });

    if (polymarketKey) {
      try {
        const apiKey = decrypt(polymarketKey.encryptedKey);

        console.log('✅ Polymarket key decrypted successfully');

        const polymarketClient = new PolymarketClient({ apiKey });
        console.log('🔄 Calling Polymarket getMarkets...');

        const markets = await polymarketClient.getMarkets({ limit: 5 });
        console.log(`✅ Polymarket returned ${markets.length} markets`);

      } catch (error) {
        console.log('❌ Polymarket client error:', error.message);
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
      }
    } else {
      console.log('❌ No Polymarket API keys found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testApiClients();
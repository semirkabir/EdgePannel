// Test Kalshi API connection and market fetching
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../lib/utils/encryption');
const { KalshiClient } = require('../lib/api/kalshi');

const prisma = new PrismaClient();

async function testKalshiConnection() {
  try {
    console.log('🔍 Testing Kalshi API Connection...\n');

    // Get the first user (for testing)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    console.log(`📋 Testing with user: ${user.email} (${user.id})\n`);

    // Get Kalshi API keys
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: 'kalshi',
        },
      },
    });

    if (!apiKeyRecord) {
      console.error('❌ No Kalshi API keys found for this user.');
      console.log('\n💡 To add Kalshi API keys:');
      console.log('1. Go to http://localhost:3000/dashboard/settings');
      console.log('2. Enter your Kalshi Access Key ID and Private Key');
      console.log('3. Click "Save Kalshi API Keys"\n');
      process.exit(1);
    }

    console.log('✅ Kalshi API keys found in database');
    console.log(`   Platform: ${apiKeyRecord.platform}`);
    console.log(`   Is Active: ${apiKeyRecord.isActive}`);
    console.log(`   Has encryptedKey: ${!!apiKeyRecord.encryptedKey}`);
    console.log(`   Has encryptedKeyData: ${!!apiKeyRecord.encryptedKeyData}\n`);

    if (!apiKeyRecord.encryptedKeyData) {
      console.error('❌ Missing encryptedKeyData (Private Key).');
      console.log('   Kalshi requires both Access Key ID and Private Key.');
      console.log('   Please re-save your Kalshi API keys in Settings.\n');
      process.exit(1);
    }

    // Decrypt keys
    console.log('🔐 Decrypting API keys...');
    let accessKeyId, privateKey;
    try {
      accessKeyId = decrypt(apiKeyRecord.encryptedKey);
      privateKey = decrypt(apiKeyRecord.encryptedKeyData);
      console.log('✅ Keys decrypted successfully');
      console.log(`   Access Key ID: ${accessKeyId.substring(0, 10)}...`);
      console.log(`   Private Key: ${privateKey.substring(0, 30)}...\n`);
    } catch (error) {
      console.error('❌ Error decrypting keys:', error.message);
      console.log('\n💡 This might be due to:');
      console.log('1. ENCRYPTION_KEY changed in .env file');
      console.log('2. Keys were encrypted with a different key');
      console.log('   Solution: Re-save your API keys in Settings\n');
      process.exit(1);
    }

    // Test Kalshi API connection
    console.log('🌐 Testing Kalshi API connection...');
    const client = new KalshiClient({ accessKeyId, privateKey });

    try {
      const markets = await client.getMarkets({ limit: 10 });
      console.log(`✅ Successfully fetched ${markets.length} markets from Kalshi!\n`);

      if (markets.length > 0) {
        console.log('📊 Sample markets:');
        markets.slice(0, 3).forEach((market, i) => {
          console.log(`\n   ${i + 1}. ${market.title}`);
          console.log(`      ID: ${market.id}`);
          console.log(`      Price: ${market.price ? (market.price * 100).toFixed(2) + '%' : 'N/A'}`);
          console.log(`      Platform: ${market.platform}`);
        });
        console.log('\n✅ Kalshi API is working correctly!');
        console.log('   Markets should appear on your dashboard.\n');
      } else {
        console.log('⚠️  No markets returned (might be filtered out)');
        console.log('   Check the Kalshi client filters in lib/api/kalshi.ts\n');
      }
    } catch (apiError) {
      console.error('❌ Error calling Kalshi API:', apiError.message);
      console.error('   Stack:', apiError.stack);
      console.log('\n💡 Common issues:');
      console.log('1. Invalid API credentials');
      console.log('2. Network connectivity issues');
      console.log('3. Kalshi API is down');
      console.log('4. Private key format is incorrect (should be PEM format)\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testKalshiConnection();


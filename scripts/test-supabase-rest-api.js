require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function testDelete() {
  console.log('🔍 Testing Supabase REST API DELETE with proper WHERE clause...\n');

  // First, check if there are any records
  console.log('1️⃣  Checking current GeotaggedMarket count...');
  try {
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/GeotaggedMarket?select=count()`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );

    const countText = await countResponse.text();
    console.log(`   Response: ${countResponse.status} - ${countText}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test different WHERE clause formats
  const whereFormats = [
    { name: 'id=neq.', url: `${supabaseUrl}/rest/v1/GeotaggedMarket?id=neq.` },
    { name: 'id=is.not.null', url: `${supabaseUrl}/rest/v1/GeotaggedMarket?id=is.not.null` },
  ];

  console.log('\n2️⃣  Testing DELETE with various WHERE clauses:\n');

  for (const format of whereFormats) {
    console.log(`   Testing: ${format.name}`);
    try {
      const response = await fetch(
        format.url,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }
      );

      const text = await response.text();
      console.log(`   ✅ Response ${response.status}: ${text || '(success - no body)'}\n`);
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}\n`);
    }
  }
}

testDelete();

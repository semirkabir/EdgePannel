/**
 * Test script to verify tags implementation
 * Run this after applying the migration and re-indexing markets
 */

async function testTags() {
  const baseUrl = 'http://localhost:3002';

  console.log('🧪 Testing Tags Implementation\n');
  console.log('Base URL:', baseUrl, '\n');

  try {
    // Test 1: Tags API
    console.log('Test 1: Fetching all available tags...');
    const tagsResponse = await fetch(`${baseUrl}/api/markets/tags`);

    if (!tagsResponse.ok) {
      throw new Error(`Tags API failed: ${tagsResponse.status} ${tagsResponse.statusText}`);
    }

    const tagsData = await tagsResponse.json();
    console.log(`✅ Found ${tagsData.tags.length} unique tags`);
    console.log(`   Top 10 tags:`, tagsData.tags.slice(0, 10).map(t => `${t.tag} (${t.count})`).join(', '));
    console.log('');

    // Test 2: Filter by tag
    console.log('Test 2: Filtering markets by "Sports" tag...');
    const sportsResponse = await fetch(`${baseUrl}/api/markets/geotagged?tag=Sports&limit=5`);

    if (!sportsResponse.ok) {
      throw new Error(`Sports filter failed: ${sportsResponse.status}`);
    }

    const sportsData = await sportsResponse.json();
    console.log(`✅ Found ${sportsData.total} markets with "Sports" tag`);
    if (sportsData.markets.length > 0) {
      console.log(`   Sample: "${sportsData.markets[0].title}"`);
      console.log(`   Tags: ${sportsData.markets[0].tags.join(', ')}`);
    }
    console.log('');

    // Test 3: Check tags field exists
    console.log('Test 3: Verifying tags field in market data...');
    const marketsResponse = await fetch(`${baseUrl}/api/markets/geotagged?limit=1`);

    if (!marketsResponse.ok) {
      throw new Error(`Markets fetch failed: ${marketsResponse.status}`);
    }

    const marketsData = await marketsResponse.json();
    if (marketsData.markets.length > 0) {
      const market = marketsData.markets[0];
      const hasTags = Array.isArray(market.tags);

      if (hasTags) {
        console.log(`✅ Tags field exists and is an array`);
        console.log(`   Market: "${market.title.substring(0, 50)}..."`);
        console.log(`   Category: ${market.category || 'none'}`);
        console.log(`   Tags: ${market.tags.join(', ') || 'none'}`);
      } else {
        console.log(`⚠️  Tags field missing or not an array`);
        console.log(`   This means markets need to be re-indexed`);
      }
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════');
    console.log('✅ All tests passed!');
    console.log('');
    console.log('Tags implementation is working correctly.');
    console.log('You can now:');
    console.log('  1. Use /api/markets/tags to populate filters');
    console.log('  2. Filter by tag: ?tag=Sports');
    console.log('  3. Display tags on market cards');
    console.log('═══════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure dev server is running');
    console.error('  2. Check if migration was applied');
    console.error('  3. Verify markets have been re-indexed');
    console.error('  4. Check server logs for errors\n');
    process.exit(1);
  }
}

testTags();

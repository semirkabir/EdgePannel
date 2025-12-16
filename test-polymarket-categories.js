/**
 * Test script to fetch and display Polymarket categories
 */

async function fetchPolymarketCategories() {
  console.log('Fetching Polymarket markets to discover categories...\n');

  try {
    // Fetch markets from Gamma API
    const url = 'https://gamma-api.polymarket.com/markets?limit=100&order=volume&ascending=false&closed=false';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const markets = await response.json();

    console.log(`✓ Fetched ${markets.length} markets\n`);

    // Extract unique categories
    const categories = new Set();
    const categoryCount = {};

    markets.forEach(market => {
      if (market.category) {
        categories.add(market.category);
        categoryCount[market.category] = (categoryCount[market.category] || 0) + 1;
      }
    });

    console.log('=== POLYMARKET CATEGORIES ===\n');
    console.log(`Found ${categories.size} unique categories:\n`);

    // Sort by count and display
    const sortedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1]);

    sortedCategories.forEach(([category, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`${category.padEnd(20)} ${bar} (${count} markets)`);
    });

    console.log('\n=== SAMPLE MARKETS BY CATEGORY ===\n');

    // Show sample markets for each category
    sortedCategories.slice(0, 10).forEach(([category]) => {
      const sampleMarket = markets.find(m => m.category === category);
      if (sampleMarket) {
        console.log(`${category}:`);
        console.log(`  "${sampleMarket.question}"`);
        console.log('');
      }
    });

    console.log('=== TAGS (if available) ===\n');

    // Check if markets have tags
    const marketWithTags = markets.find(m => m.tags && m.tags.length > 0);
    if (marketWithTags) {
      console.log('Sample tags from a market:');
      console.log(marketWithTags.tags);
    } else {
      console.log('Note: Tags are not included in the main API response.');
      console.log('Tags need to be fetched separately via /markets/{id}/tags endpoint');
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

fetchPolymarketCategories();

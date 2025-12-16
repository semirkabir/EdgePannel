/**
 * Test script to fetch Polymarket tags (which serve as categories)
 */

async function fetchPolymarketTags() {
  console.log('Fetching Polymarket tags/categories...\n');

  try {
    // First, fetch some markets to get their IDs
    const marketsUrl = 'https://gamma-api.polymarket.com/markets?limit=20&order=volume&ascending=false&closed=false';

    const marketsResponse = await fetch(marketsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!marketsResponse.ok) {
      throw new Error(`HTTP error! status: ${marketsResponse.status}`);
    }

    const markets = await marketsResponse.json();
    console.log(`✓ Fetched ${markets.length} markets\n`);

    // Fetch tags for the first few markets
    const allTags = new Set();
    const tagsByMarket = [];

    console.log('=== FETCHING TAGS FOR TOP MARKETS ===\n');

    for (let i = 0; i < Math.min(10, markets.length); i++) {
      const market = markets[i];
      const marketId = market.id;

      try {
        const tagsUrl = `https://gamma-api.polymarket.com/markets/${marketId}/tags`;
        const tagsResponse = await fetch(tagsUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (tagsResponse.ok) {
          const tags = await tagsResponse.json();

          if (Array.isArray(tags) && tags.length > 0) {
            const tagLabels = tags.map(t => t.label).filter(Boolean);
            tagsByMarket.push({
              question: market.question,
              tags: tagLabels
            });

            tagLabels.forEach(tag => allTags.add(tag));
          }
        }
      } catch (error) {
        console.log(`  ⚠ Could not fetch tags for market ${marketId}`);
      }
    }

    console.log('\n=== ALL UNIQUE POLYMARKET TAGS/CATEGORIES ===\n');
    console.log(Array.from(allTags).sort().join(', '));
    console.log(`\nTotal: ${allTags.size} unique tags\n`);

    console.log('=== SAMPLE MARKETS WITH THEIR TAGS ===\n');
    tagsByMarket.forEach(({ question, tags }) => {
      console.log(`"${question.substring(0, 70)}..."`);
      console.log(`  Tags: ${tags.join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
  }
}

fetchPolymarketTags();

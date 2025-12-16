/**
 * Re-index all markets with improved location detection
 * This will update the database with corrected country locations
 */

async function reindexMarkets() {
  console.log('Starting market re-indexing with improved location detection...\n');

  try {
    // Call the indexing API endpoint with force=true to reindex all markets
    const response = await fetch('http://localhost:3001/api/markets/index-locations?platform=all&limit=2000&force=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('✓ Re-indexing complete!\n');
    console.log('Results:');
    console.log(`  Total markets processed: ${data.results.total}`);
    console.log(`  Successfully indexed: ${data.results.indexed}`);
    console.log(`  Skipped: ${data.results.skipped}`);
    console.log(`  Failed: ${data.results.failed}`);

    if (data.results.platforms) {
      console.log('\nBy Platform:');
      Object.entries(data.results.platforms).forEach(([platform, stats]) => {
        console.log(`  ${platform}:`);
        console.log(`    - Indexed: ${stats.indexed}`);
        console.log(`    - Skipped: ${stats.skipped}`);
        console.log(`    - Failed: ${stats.failed}`);
      });
    }

    console.log('\n✓ Markets should now appear in their correct countries!');
    console.log('  Refresh your browser to see the changes.');

  } catch (error) {
    console.error('✗ Error during re-indexing:', error.message);
    console.error('\nMake sure:');
    console.error('  1. The dev server is running (npm run dev)');
    console.error('  2. You have API keys configured');
    console.error('  3. You are logged in');
  }
}

reindexMarkets();

// Test Polymarket GraphQL API
const testPolymarketAPI = async () => {
  console.log('Testing Polymarket GraphQL API...\n')

  // Simple query first
  const simpleQuery = {
    query: `
      {
        markets(first: 5, orderBy: volume, orderDirection: desc) {
          id
          question
          volume
        }
      }
    `
  }

  try {
    console.log('Sending request to Polymarket GraphQL...')
    const response = await fetch('https://api.thegraph.com/subgraphs/name/polymarket/polymarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simpleQuery),
    })

    console.log('Response status:', response.status, response.statusText)
    
    const data = await response.json()
    console.log('\nFull response:')
    console.log(JSON.stringify(data, null, 2))

    if (data.errors) {
      console.error('\n❌ GraphQL Errors:')
      data.errors.forEach(err => {
        console.error('  -', err.message)
        if (err.locations) console.error('    Locations:', err.locations)
      })
    }

    if (data.data?.markets) {
      console.log(`\n✅ Success! Found ${data.data.markets.length} markets`)
      if (data.data.markets.length > 0) {
        console.log('\nFirst market:')
        console.log(JSON.stringify(data.data.markets[0], null, 2))
      }
    } else {
      console.log('\n⚠️ No markets in response')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

testPolymarketAPI()


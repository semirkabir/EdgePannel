// Test Polymarket CLOB API
const testCLOBAPI = async () => {
  console.log('Testing Polymarket CLOB API...\n')

  const endpoints = [
    'https://clob.polymarket.com/markets',
    'https://clob.polymarket.com/v1/markets',
    'https://api.polymarket.com/markets',
    'https://polymarket.com/api/markets',
  ]

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying: ${endpoint}`)
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      console.log(`  Status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`  ✅ Success! Response type: ${Array.isArray(data) ? 'Array' : typeof data}`)
        if (Array.isArray(data)) {
          console.log(`  Found ${data.length} items`)
          if (data.length > 0) {
            console.log(`  First item keys:`, Object.keys(data[0]))
          }
        } else {
          console.log(`  Response keys:`, Object.keys(data))
        }
        console.log(`  Sample response:`, JSON.stringify(data).substring(0, 200))
        return
      } else {
        const text = await response.text()
        console.log(`  ❌ Failed: ${text.substring(0, 200)}`)
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
    }
    console.log('')
  }
}

testCLOBAPI()




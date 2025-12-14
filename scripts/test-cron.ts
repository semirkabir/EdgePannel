/**
 * Test the cron endpoint manually
 */

const CRON_SECRET = process.env.CRON_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in .env')
  console.error('Run: ./scripts/setup-cron.sh')
  process.exit(1)
}

async function testCron() {
  console.log('🧪 Testing cron endpoint...')
  console.log(`URL: ${BASE_URL}/api/cron/index-markets\n`)

  try {
    const response = await fetch(`${BASE_URL}/api/cron/index-markets`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    console.log('✅ Success!\n')
    console.log('Results:')
    console.log(JSON.stringify(data, null, 2))
  } catch (error: any) {
    console.error('❌ Failed:', error.message)
    process.exit(1)
  }
}

testCron()

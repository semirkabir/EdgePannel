/**
 * Local Market Indexing Scheduler
 *
 * Runs a cron job locally to automatically index markets every hour.
 * Use this during development or if self-hosting without Vercel.
 *
 * Usage:
 *   npm install node-cron
 *   npm run cron:start
 */

import cron from 'node-cron'

const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in .env')
  console.error('Run: ./scripts/setup-cron.sh')
  process.exit(1)
}

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

async function runIndexing() {
  console.log(`\n[${new Date().toISOString()}] 🔄 Starting automatic market indexing...`)

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

    console.log('✅ Indexing complete!')
    console.log(`   Total markets: ${data.results.total}`)
    console.log(`   Indexed: ${data.results.indexed}`)
    console.log(`   Skipped: ${data.results.skipped}`)
    console.log(`   Failed: ${data.results.failed}`)

    if (data.results.platforms) {
      console.log('\n   By Platform:')
      Object.entries(data.results.platforms).forEach(([platform, stats]: [string, any]) => {
        console.log(`   - ${platform}: ${stats.indexed} indexed, ${stats.skipped} skipped, ${stats.failed} failed`)
      })
    }
  } catch (error: any) {
    console.error('❌ Indexing failed:', error.message)
  }
}

// Run immediately on startup
console.log('🚀 Market Indexing Scheduler Started')
console.log('⏰ Schedule: Every hour (0 * * * *)')
console.log('🌐 Target: ' + BASE_URL)
console.log('\nRunning initial indexing...')

runIndexing()

// Schedule to run every hour at minute 0
cron.schedule('0 * * * *', () => {
  runIndexing()
}, {
  timezone: 'UTC'
})

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n\n👋 Scheduler stopped')
  process.exit(0)
})

console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.')

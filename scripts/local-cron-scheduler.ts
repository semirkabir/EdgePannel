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

async function triggerTask(endpoint: string, name: string) {
  console.log(`[${new Date().toISOString()}] 🔄 Starting: ${name}...`)
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`✅ ${name} complete!`)
    return data
  } catch (error: any) {
    console.error(`❌ ${name} failed:`, error.message)
    return null
  }
}

async function runFullMaintenance() {
  console.log('\n--- Scheduled Maintenance Start ---')
  await triggerTask('/api/cron/index-markets', 'Market Indexing')
  await triggerTask('/api/cron/cleanup-expired', 'Cleanup Expired')
  await triggerTask('/api/cron/snapshot-prices', 'Price Snapshots')
  console.log('--- Scheduled Maintenance End ---\n')
}

// Startup logic
console.log('🚀 VPS Background Scheduler Started')
console.log('⏰ Schedule: Every 4 hours (full maintenance), Every 30 minutes (incremental sync)')
console.log('🌐 Target: ' + BASE_URL)

// Wait 2 minutes for Next.js to fully boot before initial run
console.log('⏳ Waiting for server to boot...')
setTimeout(() => {
  triggerTask('/api/cron/sync-new-markets', 'Initial Incremental Sync')
}, 120000)

// Schedule: Every 4 hours (reduced from hourly to reduce CPU load)
cron.schedule('0 */4 * * *', () => {
  runFullMaintenance()
}, { timezone: 'UTC' })

// Schedule: Every 30 minutes incremental sync (reduced from 5 minutes)
cron.schedule('*/30 * * * *', () => {
  triggerTask('/api/cron/sync-new-markets', 'Incremental Sync')
}, { timezone: 'UTC' })

process.on('SIGINT', () => {
  console.log('\n👋 Scheduler stopped')
  process.exit(0)
})


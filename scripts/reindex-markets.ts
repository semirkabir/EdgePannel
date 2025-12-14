import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function reindexMarkets() {
  try {
    console.log('🗑️  Clearing existing indexed markets...')

    const deleted = await prisma.geotaggedMarket.deleteMany({})
    console.log(`✅ Deleted ${deleted.count} existing records\n`)

    console.log('📍 Ready to re-index!')
    console.log('Next step: Go to http://localhost:3000/admin/index-markets')
    console.log('Click "Index All Platforms" to re-index with the fixed location extraction logic.\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

reindexMarkets()

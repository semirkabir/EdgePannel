import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkIndexedMarkets() {
  try {
    // Get sample of indexed markets
    const markets = await prisma.geotaggedMarket.findMany({
      take: 20,
      select: {
        title: true,
        country: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        confidence: true,
        extractedFrom: true,
      }
    })

    console.log('\n=== Indexed Markets Sample ===\n')

    markets.forEach((market, i) => {
      console.log(`${i + 1}. ${market.title}`)
      console.log(`   Location: ${market.city || market.country || market.region || 'Unknown'}`)
      console.log(`   Coords: [${market.latitude}, ${market.longitude}]`)
      console.log(`   Confidence: ${market.confidence}`)
      console.log(`   Extracted From: ${market.extractedFrom}`)
      console.log('')
    })

    // Get stats
    const total = await prisma.geotaggedMarket.count()
    const byCountry = await prisma.geotaggedMarket.groupBy({
      by: ['country'],
      _count: true,
      orderBy: {
        _count: {
          country: 'desc'
        }
      },
      take: 10
    })

    console.log(`\n=== Statistics ===`)
    console.log(`Total indexed: ${total}`)
    console.log(`\nTop Countries:`)
    byCountry.forEach(c => {
      console.log(`  ${c.country}: ${c._count} markets`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkIndexedMarkets()

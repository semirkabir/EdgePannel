const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
    try {
        const total = await prisma.geotaggedMarket.count();
        console.log(`Total Geotagged Markets: ${total}`);

        // Breakdown by platform
        const poly = await prisma.geotaggedMarket.count({
            where: { platform: 'polymarket' }
        });
        console.log(`Polymarket: ${poly}`);

        const kalshi = await prisma.geotaggedMarket.count({
            where: { platform: 'kalshi' }
        });
        console.log(`Kalshi: ${kalshi}`);

        // Breakdown by location status
        const withLoc = await prisma.geotaggedMarket.count({
            where: { latitude: { not: null } }
        });
        console.log(`With Location: ${withLoc}`);
        console.log(`Without Location (Global/Unknown): ${total - withLoc}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkCounts();

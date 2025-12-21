const { PrismaClient } = require('@prisma/client');

async function checkDb() {
    const prisma = new PrismaClient();
    try {
        const userCount = await prisma.user.count();
        const marketCount = await prisma.geotaggedMarket.count();
        console.log(`Users: ${userCount}`);
        console.log(`Geotagged Markets: ${marketCount}`);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkDb();

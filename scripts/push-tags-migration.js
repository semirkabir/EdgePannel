/**
 * Push tags migration to Supabase using Prisma
 */

const { PrismaClient } = require('@prisma/client');

async function pushMigration() {
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

  try {
    console.log('🚀 Pushing tags migration to Supabase...\n');

    // Check if column already exists
    console.log('Checking if tags column exists...');
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'GeotaggedMarket'
      AND column_name = 'tags';
    `;

    if (columnCheck.length > 0) {
      console.log('✅ Tags column already exists!\n');
      console.log('Skipping column creation...\n');
    } else {
      console.log('📝 Adding tags column...');

      // Add tags column
      await prisma.$executeRaw`
        ALTER TABLE "GeotaggedMarket"
        ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
      `;

      console.log('✅ Tags column added successfully!\n');
    }

    // Check if index exists
    console.log('Checking category index...');
    const indexCheck = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'GeotaggedMarket'
      AND indexname = 'GeotaggedMarket_category_idx';
    `;

    if (indexCheck.length > 0) {
      console.log('✅ Category index already exists!\n');
    } else {
      console.log('📝 Creating category index...');

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "GeotaggedMarket_category_idx"
        ON "GeotaggedMarket"("category");
      `;

      console.log('✅ Category index created!\n');
    }

    // Update existing records to have empty tags array
    console.log('Updating existing records...');
    const updateResult = await prisma.$executeRaw`
      UPDATE "GeotaggedMarket"
      SET "tags" = ARRAY[]::TEXT[]
      WHERE "tags" IS NULL;
    `;

    console.log(`✅ Updated ${updateResult} records\n`);

    // Verify everything
    console.log('═══════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════\n');

    const tableInfo = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'GeotaggedMarket'
      AND column_name IN ('tags', 'category')
      ORDER BY column_name;
    `;

    console.log('Table structure:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const indexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'GeotaggedMarket'
      AND indexname LIKE '%category%';
    `;

    console.log('\nIndexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log('\n📋 Next Steps:');
    console.log('   1. Go to http://localhost:3002/admin/index-markets');
    console.log('   2. Click "⚠️ Clear All & Re-index (Fresh Start)"');
    console.log('   3. Wait for indexing (2-5 minutes)');
    console.log('   4. Tags will be fetched for each market\n');

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.code === 'P2010') {
      console.log('\n💡 Raw query failed. This might mean:');
      console.log('   - The migration was already applied');
      console.log('   - Try re-indexing your markets to populate tags\n');
    } else {
      console.error('\nFull error:', error);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

pushMigration();

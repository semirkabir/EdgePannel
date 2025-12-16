/**
 * Apply the tags migration to the database
 * This adds the tags column and index to the GeotaggedMarket table
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Applying tags migration to database...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', 'add_tags_to_markets.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('\n---\n');

    // Execute the migration
    await prisma.$executeRawUnsafe(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify the migration worked
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'GeotaggedMarket'
      AND column_name = 'tags';
    `;

    if (result && result.length > 0) {
      console.log('✅ Verified: tags column exists');
      console.log('   Column details:', result[0]);
    } else {
      console.log('⚠️  Warning: Could not verify tags column');
    }

    // Check for category index
    const indexResult = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'GeotaggedMarket'
      AND indexname = 'GeotaggedMarket_category_idx';
    `;

    if (indexResult && indexResult.length > 0) {
      console.log('✅ Verified: category index exists');
    } else {
      console.log('⚠️  Warning: Could not verify category index');
    }

    console.log('\n📋 Next steps:');
    console.log('   1. Go to http://localhost:3002/admin/index-markets');
    console.log('   2. Click "⚠️ Clear All & Re-index (Fresh Start)"');
    console.log('   3. Wait for indexing to complete (2-5 minutes)');
    console.log('   4. Tags will be fetched for each Polymarket market\n');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('\nDetails:', error);

    if (error.message.includes('already exists')) {
      console.log('\n💡 The tags column may already exist. This is okay!');
      console.log('   Try re-indexing your markets to populate the tags.\n');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

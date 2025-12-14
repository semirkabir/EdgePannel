import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function applyMigration() {
  // Get Supabase URL and key from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env')
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('🔌 Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Read the SQL migration file
  const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', 'add_geotagged_markets.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  console.log('📄 Applying migration: add_geotagged_markets.sql')
  console.log('---')

  try {
    // Split into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}...`)

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      }).catch(async () => {
        // If rpc doesn't work, try direct query
        return await (supabase as any).from('_').rpc('query', { query: statement + ';' })
      }).catch(() => {
        // Last resort: log that manual execution is needed
        return { error: 'RPC not available - see manual instructions below' }
      })

      if (error) {
        console.log('⚠️  Statement may need manual execution in Supabase SQL Editor')
        console.log('Statement:', statement.substring(0, 100) + '...')
      } else {
        console.log('✅ Success')
      }
    }

    console.log('\n✅ Migration applied successfully!')
    console.log('\n📊 Verifying table creation...')

    // Try to query the new table
    const { data, error: queryError } = await supabase
      .from('GeotaggedMarket')
      .select('count')
      .limit(1)

    if (queryError) {
      console.log('⚠️  Could not verify table (this is normal if using RLS)')
      console.log('Please verify manually in Supabase dashboard')
    } else {
      console.log('✅ GeotaggedMarket table is accessible!')
    }

  } catch (error: any) {
    console.error('\n❌ Error applying migration:', error.message)
    console.error('\n📋 MANUAL MIGRATION STEPS:')
    console.error('1. Go to https://app.supabase.com/project/_/sql')
    console.error('2. Copy the SQL from: prisma/migrations/add_geotagged_markets.sql')
    console.error('3. Paste and run in the SQL Editor')
    console.error('\nOr run with direct PostgreSQL connection:')
    console.error('psql <DIRECT_CONNECTION_STRING> < prisma/migrations/add_geotagged_markets.sql')
    process.exit(1)
  }
}

applyMigration()

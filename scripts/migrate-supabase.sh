#!/bin/bash

echo "🗄️  Supabase Migration Script"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Extract database URL
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2)

if [ -z "$DB_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env"
    exit 1
fi

# Convert pooler URL to direct connection (port 6543 -> 5432)
DIRECT_URL=$(echo $DB_URL | sed 's/:6543/:5432/g' | sed 's/\.pooler\././g')

echo "📡 Database: Supabase PostgreSQL"
echo "🔌 Connection: Direct (non-pooled)"
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "✅ psql found - Applying migration..."
    echo ""

    PGPASSWORD=$(echo $DIRECT_URL | grep -oP '://[^:]+:\K[^@]+') \
    psql "$DIRECT_URL" < prisma/migrations/add_geotagged_markets.sql

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Migration applied successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Go to http://localhost:3000/admin/index-markets"
        echo "2. Click 'Index All Platforms' to geocode markets"
        echo "3. View results at http://localhost:3000/polyglobe"
    else
        echo ""
        echo "❌ Migration failed. See manual instructions below."
        SHOW_MANUAL=1
    fi
else
    echo "⚠️  psql not found - Manual migration required"
    SHOW_MANUAL=1
fi

if [ ! -z "$SHOW_MANUAL" ]; then
    echo ""
    echo "📋 MANUAL MIGRATION INSTRUCTIONS:"
    echo "=================================="
    echo ""
    echo "Option 1 - Supabase Dashboard (Recommended):"
    echo "1. Go to: https://app.supabase.com/project/_/sql/new"
    echo "2. Copy contents from: prisma/migrations/add_geotagged_markets.sql"
    echo "3. Paste into SQL Editor and click 'Run'"
    echo ""
    echo "Option 2 - Direct SQL Connection:"
    echo "psql \"$DIRECT_URL\" < prisma/migrations/add_geotagged_markets.sql"
    echo ""
fi

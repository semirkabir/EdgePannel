#!/bin/bash

echo "🔧 Market Indexing Cron Setup"
echo "=============================="
echo ""

# Check if CRON_SECRET exists in .env
if ! grep -q "CRON_SECRET" .env 2>/dev/null; then
    echo "⚠️  CRON_SECRET not found in .env"
    echo "Generating a secure secret..."

    CRON_SECRET=$(openssl rand -hex 32)
    echo "CRON_SECRET=$CRON_SECRET" >> .env
    echo "✅ Added CRON_SECRET to .env"
    echo ""
fi

CRON_SECRET=$(grep CRON_SECRET .env | cut -d '=' -f2)

echo "📋 Choose your deployment method:"
echo ""
echo "1️⃣  Vercel (Recommended)"
echo "   - Automatic hourly execution"
echo "   - No server maintenance required"
echo "   - vercel.json already configured"
echo ""
echo "   Next steps:"
echo "   1. Add CRON_SECRET to Vercel environment variables:"
echo "      vercel env add CRON_SECRET production"
echo "      (Enter: $CRON_SECRET)"
echo ""
echo "   2. Deploy to Vercel:"
echo "      vercel --prod"
echo ""
echo "   The cron will run automatically every hour!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣  Self-Hosted (Local Server)"
echo "   - Requires server to run 24/7"
echo "   - Use system crontab or node-cron"
echo ""
echo "   Option A - System Crontab:"
echo "   Add to crontab (crontab -e):"
echo "   0 * * * * curl -H 'Authorization: Bearer $CRON_SECRET' http://localhost:3000/api/cron/index-markets"
echo ""
echo "   Option B - Use EasyCron or similar service:"
echo "   URL: http://your-domain.com/api/cron/index-markets"
echo "   Header: Authorization: Bearer $CRON_SECRET"
echo "   Schedule: Every hour (0 * * * *)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "3️⃣  Manual Testing"
echo "   Test the cron endpoint now:"
echo "   curl -H 'Authorization: Bearer $CRON_SECRET' http://localhost:3000/api/cron/index-markets"
echo ""

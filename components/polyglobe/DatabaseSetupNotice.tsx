'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, CheckCircle, Database, ExternalLink } from 'lucide-react'

const MIGRATION_SQL = `-- CreateTable: GeotaggedMarket
CREATE TABLE IF NOT EXISTS "GeotaggedMarket" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "probability" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "endDate" TIMESTAMP(3),
    "slug" TEXT,
    "ticker" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "confidence" TEXT,
    "extractedFrom" TEXT,
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeotaggedMarket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GeotaggedMarket_marketId_key" ON "GeotaggedMarket"("marketId");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_platform_idx" ON "GeotaggedMarket"("platform");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_country_idx" ON "GeotaggedMarket"("country");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_latitude_longitude_idx" ON "GeotaggedMarket"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_confidence_idx" ON "GeotaggedMarket"("confidence");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_endDate_idx" ON "GeotaggedMarket"("endDate");
COMMENT ON TABLE "GeotaggedMarket" IS 'Markets with extracted geolocation data for map visualization';`

export function DatabaseSetupNotice() {
  const [copied, setCopied] = useState(false)

  const copySQL = async () => {
    await navigator.clipboard.writeText(MIGRATION_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-gray-900 border-yellow-500/50 shadow-2xl">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">Database Setup Required</h2>
              <p className="text-gray-400">
                The GeotaggedMarket table needs to be created in your database before you can use the geocoded markets feature.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Copy the SQL migration</p>
                  <p className="text-sm text-gray-400">Click the button below to copy the SQL to your clipboard</p>
                </div>
              </div>

              <Button
                onClick={copySQL}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy SQL Migration
                  </>
                )}
              </Button>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Run SQL Migration</p>
                  <p className="text-sm text-gray-400">Use Prisma to apply the migration or run SQL directly in your database</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  // Run Prisma migration
                  window.open('https://www.prisma.io/docs/concepts/components/prisma-migrate', '_blank')
                }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Prisma Migration Docs
              </Button>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Paste and Run</p>
                  <p className="text-sm text-gray-400">
                    Paste the SQL into the editor and click &quot;Run&quot; or press Ctrl+Enter
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  4
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Refresh and Index</p>
                  <p className="text-sm text-gray-400">
                    Reload this page, then go to <code className="text-blue-400">/admin/index-markets</code> to index your markets
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              💡 <strong>What this does:</strong> Creates a table to store markets with GPS coordinates extracted from their titles.
              This enables the map visualization feature with unlimited markets!
            </p>
          </div>

          {/* SQL Preview */}
          <details className="bg-gray-800/30 rounded-lg">
            <summary className="p-3 text-sm text-gray-400 cursor-pointer hover:text-white">
              View SQL (click to expand)
            </summary>
            <pre className="p-3 text-xs text-gray-300 overflow-x-auto border-t border-gray-700">
              {MIGRATION_SQL}
            </pre>
          </details>
        </div>
      </Card>
    </div>
  )
}

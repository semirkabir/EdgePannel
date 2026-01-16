# Production Migration Fix: GeotaggedMarket Table Missing

## Issue
The cron job `index-markets` is failing with Prisma error `P2021`: table `public.GeotaggedMarket` does not exist. This indicates that the database migration that creates this table hasn't been applied to the production database.

## Root Cause
The Prisma schema includes a `GeotaggedMarket` model, but the corresponding migration (`20251217034300_init`) hasn't been deployed. The migration tracking table `_prisma_migrations` is missing, meaning no migrations have been recorded.

## Solution
Apply the missing migration to the production database. Two approaches are provided:

### Option A: Use Prisma Migrate (Recommended)
If you have access to the production environment with the `DATABASE_URL` environment variable set, run:

```bash
# Navigate to the project directory
cd /app

# Apply pending migrations
npx prisma migrate deploy
```

If the above fails due to existing tables, you can mark the initial migration as already applied (if all tables except GeotaggedMarket already exist):

```bash
npx prisma migrate resolve --applied 20251217034300_init
```

Then run `npx prisma migrate deploy` to apply any remaining migrations.

### Option B: Manual SQL Execution
If you cannot run Prisma CLI in production, execute the following SQL directly on your production database (via Supabase dashboard, psql, or any SQL client).

#### 1. Create the GeotaggedMarket table (if not exists)
```sql
-- CreateTable: GeotaggedMarket
-- This table stores markets with extracted geolocation data for map visualization

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

-- Create indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS "GeotaggedMarket_marketId_key" ON "GeotaggedMarket"("marketId");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_platform_idx" ON "GeotaggedMarket"("platform");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_country_idx" ON "GeotaggedMarket"("country");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_latitude_longitude_idx" ON "GeotaggedMarket"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_confidence_idx" ON "GeotaggedMarket"("confidence");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_endDate_idx" ON "GeotaggedMarket"("endDate");
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_category_idx" ON "GeotaggedMarket"("category");

-- Add table comment
COMMENT ON TABLE "GeotaggedMarket" IS 'Markets with extracted geolocation data for map visualization';
```

#### 2. Record the migration (optional but recommended)
If you want to keep Prisma migration tracking consistent, insert a row into `_prisma_migrations`. First ensure the table exists; if not, you can skip this step.

```sql
-- Create the _prisma_migrations table if missing (schema from Prisma)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP WITH TIME ZONE,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP WITH TIME ZONE,
    "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Insert the init migration record (adjust checksum if needed)
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES ('20251217034300_init', 'a1b2c3d4e5f6...', NOW(), '20251217034300_init', NOW(), 1)
ON CONFLICT (id) DO NOTHING;
```

**Note**: The exact checksum can be obtained by running `prisma migrate diff` locally. If you cannot obtain it, you may omit this step and rely on `prisma migrate resolve` later.

### Verification
After applying the migration, verify that the table exists and the cron job works:

1. Connect to the production database and run:
   ```sql
   SELECT COUNT(*) FROM "GeotaggedMarket";
   ```
   Should return a count (maybe zero).

2. Trigger the cron job manually (or wait for the next run) and check logs for any remaining errors.

## Local Environment Fix
We have already updated `.env` to point to the local Docker PostgreSQL instance (`DATABASE_URL="postgresql://postgres:password@localhost:5432/webapp"`). Ensure the local database container is running (`docker-compose up -d`). Then run `npx prisma migrate deploy` locally to sync migration history.

## Next Steps
- Monitor the cron job logs for successful indexing.
- Consider implementing a migration health check to prevent similar issues.
- Review the deployment pipeline to ensure migrations are always applied before application startup.

## Support
If you encounter any issues, please provide the error messages and we can adjust the solution accordingly.
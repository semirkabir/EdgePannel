#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --accept-data-loss

echo "Starting Next.js server..."
node server.js &

echo "Starting cron scheduler..."
npx tsx scripts/local-cron-scheduler.ts &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?

#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate -w @infraops/api

echo "Seeding database (idempotent)..."
npm run db:seed -w @infraops/api

echo "Starting embedded BullMQ worker..."
node apps/worker/dist/main.js &

echo "Starting API server..."
exec npm run start -w @infraops/api

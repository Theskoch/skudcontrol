#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Running seed..."
npx prisma db seed

exec "$@"

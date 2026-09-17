#!/bin/sh
set -e

cd "$(dirname "$0")/.."
set -a
. ./.env
set +a

mkdir -p ./data/backups
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="./data/backups/skudcontrol-${STAMP}.sql"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$FILE"
echo "Backup written to $FILE"

#!/bin/sh
set -e

DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

echo "\n📋 /etc/hosts content:"
cat /etc/hosts

echo "\n⏳ Waiting for Postgres at ${DB_HOST}:${DB_PORT} to be reachable..."
WAIT_TRIES=0
until nc -z "$DB_HOST" "$DB_PORT"
do
  WAIT_TRIES=$((WAIT_TRIES+1))
  echo "Postgres not reachable yet (attempt $WAIT_TRIES). Sleeping 3s..."
  sleep 3
  if [ $WAIT_TRIES -ge 60 ]; then
    echo "Still waiting for Postgres after $WAIT_TRIES attempts — continuing to wait..."
    WAIT_TRIES=0
  fi
done
echo "✅ Postgres is reachable — running sequelize-cli migrations"

# Run migrations via sequelize-cli using the plain-config file and custom migrations path.
# --config     → src/config/database.cjs  (CJS plain-config, sequelize-cli cannot parse ESM)
# --migrations-path → src/migrations       (our custom .cjs migration files)
# --env production → picks the production block from database.cjs

TRIES=0
until [ $TRIES -ge 5 ]
do
  npx sequelize-cli db:migrate \
    --config src/config/database.cjs \
    --migrations-path src/migrations \
    --env production \
    && break
  TRIES=$((TRIES+1))
  echo "Migration attempt $TRIES failed — retrying in 5s..."
  sleep 5
done

if [ $TRIES -ge 5 ]; then
  echo "\n❌ Migrations failed after $TRIES attempts. Exiting."
  exit 1
fi

echo "\n✅ Migrations completed. Starting server..."
exec node src/server.js

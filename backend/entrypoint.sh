#!/bin/sh
set -e

echo "\n🔁 Running DB migrations (sequelize.sync)..."
# Wait for Postgres TCP port to be reachable before attempting migrations
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
  # after many attempts keep trying — this waiting loop prevents premature exit
  if [ $WAIT_TRIES -ge 60 ]; then
    echo "Still waiting for Postgres after $WAIT_TRIES attempts — continuing to wait..."
    WAIT_TRIES=0
  fi
done
echo "Postgres is reachable — running migrations"

# Run migrations; if they fail because DB not ready yet, retry a few times
TRIES=0
until [ $TRIES -ge 30 ]
do
  node src/config/migrate.js && break
  TRIES=$((TRIES+1))
  echo "Migration attempt $TRIES failed — retrying in 5s..."
  sleep 5
done

if [ $TRIES -ge 30 ]; then
  echo "\n❌ Migrations failed after $TRIES attempts. Exiting."
  exit 1
fi

echo "\n✅ Migrations completed. Starting server..."
exec node src/server.js

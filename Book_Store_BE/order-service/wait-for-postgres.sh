#!/bin/sh
set -e

host="$1"
shift

echo "Waiting for PostgreSQL at $host to become available..."

# Loop until pg_isready returns 0
until pg_isready -h "$host" -U postgres; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"

# Execute the provided CMD
exec "$@"

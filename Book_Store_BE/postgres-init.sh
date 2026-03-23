#!/bin/sh
set -eu

if [ -z "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  exit 0
fi

echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
OLD_IFS="$IFS"
IFS=','
for database in $POSTGRES_MULTIPLE_DATABASES; do
  echo "  Creating user and database '$database'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE USER \"$database\" WITH PASSWORD '$database' CREATEDB;"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE \"$database\";"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "GRANT ALL PRIVILEGES ON DATABASE \"$database\" TO \"$database\";"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d "$database" -c "GRANT ALL ON SCHEMA public TO \"$database\";"
done
IFS="$OLD_IFS"

echo "Multiple databases created"
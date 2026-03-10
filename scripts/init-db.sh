#!/usr/bin/env bash
set -euo pipefail

echo "Starting Mongo and Redis via docker-compose..."
docker compose -f docker-compose.yml up -d

echo "Waiting for Mongo to be ready..."
until docker exec -i smartgate_mongo mongo --eval "print('mongo ok')" >/dev/null 2>&1; do
  sleep 1
done

echo "Initiating replica set..."
docker exec -i smartgate_mongo mongo --eval 'rs.initiate()' || true

echo "Mongo replica set initiated. Services are up."


#!/usr/bin/env bash
set -euo pipefail

# Usage: ./restore.sh /path/to/dump.archive.gz
IN_ARCHIVE=${1:-""}
MONGO_URI="${MONGODB_URI:-mongodb://localhost:27017/smartgate}"

if [ -z "$IN_ARCHIVE" ]; then
  echo "Please provide path to dump archive"
  exit 1
fi

echo "Restoring MongoDB from $IN_ARCHIVE"
mongorestore --uri="$MONGO_URI" --gzip --archive="$IN_ARCHIVE" --drop
echo "Restore completed"


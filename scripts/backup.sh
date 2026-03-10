#!/usr/bin/env bash
set -euo pipefail

# Usage: ./backup.sh /path/to/backup/dir
OUT_DIR=${1:-"./backups/$(date +%Y%m%d_%H%M%S)"}
MONGO_URI="${MONGODB_URI:-mongodb://localhost:27017/smartgate}"

mkdir -p "$OUT_DIR"
echo "Backing up MongoDB to $OUT_DIR"
mongodump --uri="$MONGO_URI" --gzip --archive="$OUT_DIR/dump.archive.gz"
echo "Backup completed: $OUT_DIR/dump.archive.gz"


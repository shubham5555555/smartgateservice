Production Notes
----------------

Required services:
- MongoDB replica set (MONGODB_URI)
- Redis (for caching and BullMQ) (REDIS_URL)

Backups:
- Use `./backend/scripts/backup.sh` to create compressed mongodump archives.
- Use `./backend/scripts/restore.sh` to restore from an archive.

High level:
- Ensure MongoDB runs as a replica set for transactions to work.
- Configure environment variables in production: MONGODB_URI, REDIS_URL, CLOUDINARY_*, JWT_SECRET, etc.


#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backups
tar czf "/backups/openclaw_$DATE.tar.gz" \
  /docker/openclaw-sbem/data/.openclaw/ \
  /docker/openclaw-sbem/.env 2>/dev/null
ls -t /backups/openclaw_*.tar.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null
echo "$(date): Backup OK - openclaw_$DATE.tar.gz" >> /backups/backup.log

#!/bin/bash
CONTAINER="openclaw-sbem-openclaw-1"
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "$(date): Container DOWN! Reiniciando..." >> /var/log/openclaw-health.log
  cd /docker/openclaw-sbem && docker compose restart
fi

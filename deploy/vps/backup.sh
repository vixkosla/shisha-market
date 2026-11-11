#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>/run/lock/shisha-backup.lock
flock -n 9 || exit 0
backup_root=/var/backups/shisha-market
backup_stage=$(mktemp -d "$backup_root/staging.XXXXXXXX")
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
app_was_active=0
storage_was_active=0
systemctl is-active --quiet shisha-market && app_was_active=1
systemctl is-active --quiet shisha-storage && storage_was_active=1
restore_services() {
  if [ "$storage_was_active" = 1 ]; then systemctl start shisha-storage; fi
  if [ "$app_was_active" = 1 ]; then systemctl start shisha-market; fi
}
trap restore_services EXIT
# Brief downtime makes the DB and single-node storage copy consistent.
systemctl stop shisha-market shisha-storage
runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl shisha > "$backup_stage/database.dump"
tar -czf "$backup_stage/private-config-and-storage.tar.gz" -C / etc/shisha-market var/lib/shisha-storage var/lib/shisha-caddy
(cd "$backup_stage" && sha256sum database.dump private-config-and-storage.tar.gz) > "$backup_stage/checksums.txt"
tar -czf "$backup_root/shisha-$backup_stamp.tar.gz" -C "$backup_stage" database.dump private-config-and-storage.tar.gz checksums.txt
# Remove only these generated staging files, never user directories.
unlink "$backup_stage/database.dump"
unlink "$backup_stage/private-config-and-storage.tar.gz"
unlink "$backup_stage/checksums.txt"
rmdir "$backup_stage"
restore_services
trap - EXIT
# This directory is exclusive to this backup job; keep two weeks locally.
find /var/backups/shisha-market -maxdepth 1 -type f -name 'shisha-????????T??????Z.tar.gz' -mtime +13 -delete
echo "$backup_root/shisha-$backup_stamp.tar.gz"

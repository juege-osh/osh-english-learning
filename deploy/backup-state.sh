#!/bin/sh
set -eu
umask 077

state_dir=${1:-/var/lib/english-quest}
backup_dir=${2:-/var/backups/english-quest}
install -d -m 0700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp "$backup_dir/.state-XXXXXX")
trap 'rm -f "$temporary"' EXIT HUP INT TERM
COPYFILE_DISABLE=1 tar -C "$(dirname "$state_dir")" -czf "$temporary" "$(basename "$state_dir")"
tar -tzf "$temporary" >/dev/null
final="$backup_dir/state-$stamp.tar.gz"
mv "$temporary" "$final"
printf '%s\n' "$final"

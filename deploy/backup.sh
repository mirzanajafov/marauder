#!/bin/sh
set -eu

dir=/backups
keep_days=${KEEP_DAYS:-14}

dump() {
  stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  target="$dir/marauder-$1$stamp.dump"
  if pg_dump -Fc --no-owner \
    --exclude-table-data='_timescaledb_internal.*' \
    --exclude-table-data=public.positions >"$target.partial"; then
    mv "$target.partial" "$target"
    echo "backup: wrote $target ($(du -h "$target" | cut -f1))"
  else
    rm -f "$target.partial"
    echo "backup: FAILED $target" >&2
    return 1
  fi
  find "$dir" -name 'marauder-*.dump' -mtime "+$keep_days" -print -delete
}

if [ "${1:-}" = once ]; then
  dump "${2:-}"
  exit 0
fi

echo "backup: daily at 03:00 UTC, keeping $keep_days days"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%Y-%m-%d) 03:00" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -gt "$now" ] || next=$((next + 86400))
  sleep $((next - now))
  dump "" || true
done

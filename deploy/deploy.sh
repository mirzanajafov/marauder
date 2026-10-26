#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

compose=(docker compose -f docker-compose.prod.yml)
built=(api web simulator)
kept=()

say() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

keep_running_images() {
  local service image
  for service in "${built[@]}"; do
    if image=$(docker container inspect --format '{{.Image}}' "marauder-$service" 2>/dev/null); then
      docker tag "$image" "marauder-$service:previous" || return 1
      kept+=("$service")
    fi
  done
}

restore_running_images() {
  local service
  for service in "${kept[@]}"; do
    docker tag "marauder-$service:previous" "marauder-$service"
  done
}

settings_accepted() {
  "${compose[@]}" run --rm --no-deps api node dist/check-config.js &&
    "${compose[@]}" run --rm --no-deps simulator node dist/check-config.js
}

query() {
  "${compose[@]}" exec -T timescaledb psql -U marauder -d marauder -tA -c "$1"
}

migration_rows() {
  local tracked
  tracked=$(query "SELECT to_regclass('public._prisma_migrations') IS NOT NULL") || return 1
  if [ "$tracked" = t ]; then
    query "SELECT migration_name || ' ' || CASE WHEN rolled_back_at IS NOT NULL THEN 'rolled-back'
      WHEN finished_at IS NOT NULL THEN 'applied' ELSE 'failed' END FROM _prisma_migrations"
  fi
}

count_rows() {
  printf '%s\n' "$1" | awk 'NF { n++ } END { print n + 0 }'
}

start() {
  "${compose[@]}" up -d --wait --wait-timeout 300 --remove-orphans &&
    "${compose[@]}" exec -T web wget -q -T 5 -O /dev/null http://127.0.0.1/api/health
}

release() {
  if [ "$migrating" = yes ]; then
    say "this release migrates the database, so the running api stops first"
    "${compose[@]}" stop api || { say "could not stop the running api"; return 1; }
    "${compose[@]}" run --rm --no-deps api ./node_modules/.bin/prisma migrate deploy ||
      { say "the migration failed"; return 1; }
  fi
  start || { say "not every service came up healthy, or the site can't reach the api"; return 1; }
}

give_up() {
  say "$1, so the release stops before the app restarts"
  git reset --hard --quiet "$previous"
  restore_running_images
  "${compose[@]}" up -d --wait timescaledb ||
    say "the database did not come back healthy, look at: ${compose[*]} logs timescaledb"
  exit 1
}

roll_back() {
  if [ "$migrating" = yes ]; then
    if rows_after=$(migration_rows); then
      started_after=$(count_rows "$rows_after")
    else
      started_after=unknown
    fi
    if [ "$started_after" != "$started_before" ]; then
      say "$1, after it started migrating the database, which the code it replaced may not read"
      say "check prisma migrate status, then fix forward or restore the predeploy dump from the backups volume as the README describes"
      exit 1
    fi
  fi
  say "$1, rolling back to $(git rev-parse --short "$previous") and the images that were running"
  git reset --hard --quiet "$previous"
  restore_running_images
  if start; then
    say "rolled back to $(git log --oneline -1)"
  else
    say "still not healthy after the rollback, look at: ${compose[*]} logs --tail 50"
  fi
  exit 1
}

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  say "tracked files have local changes, refusing to deploy over them"
  git status --short --untracked-files=no
  exit 1
fi

say "backing up names, floor plans and receivers before anything changes"
if "${compose[@]}" ps --status running --services | grep -qx backup; then
  "${compose[@]}" exec -T backup sh /usr/local/bin/backup.sh once predeploy-
else
  "${compose[@]}" run --rm backup once predeploy-
fi

previous=$(git rev-parse HEAD)
say "fetching main"
git fetch --quiet origin main
git merge --ff-only --quiet origin/main

if [ "$previous" = "$(git rev-parse HEAD)" ]; then
  say "already at $(git log --oneline -1), rebuilding anyway"
else
  say "moving $(git rev-parse --short "$previous") -> $(git log --oneline -1)"
fi

keep_running_images || give_up "could not tag the images that are running"
"${compose[@]}" build || give_up "the build failed"

say "checking the new release against deploy/.env before anything restarts"
settings_accepted || give_up "the new release refuses the settings named above"

"${compose[@]}" up -d --wait timescaledb || give_up "the database did not come up healthy"
shipped=$(find ../apps/api/prisma/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort)
rows=$(migration_rows) || give_up "could not read the migrations in the database"
applied=$(printf '%s\n' "$rows" | awk '$2 == "applied" { print $1 }' | LC_ALL=C sort)
failed=$(printf '%s\n' "$rows" | awk '$2 == "failed" { print $1 }')
started_before=$(count_rows "$rows")
[ -z "$failed" ] || give_up "migration $failed is recorded as failed, resolve it with prisma migrate resolve first"
unknown=$(comm -13 <(printf '%s\n' "$shipped") <(printf '%s\n' "$applied"))
[ -z "$unknown" ] || give_up "the database has migrations this release does not ship: $unknown"
pending=$(comm -23 <(printf '%s\n' "$shipped") <(printf '%s\n' "$applied"))
migrating=no
if [ -n "$pending" ]; then
  migrating=yes
fi

say "restarting and waiting for every service to be healthy"
if release; then
  say "deployed $(git log --oneline -1)"
  exit 0
fi
roll_back "the release did not finish"

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

compose=(docker compose -f docker-compose.prod.yml)
built=(api web simulator)
kept=()

say() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

healthy() {
  for _ in $(seq 1 60); do
    if "${compose[@]}" exec -T api node -e \
      "fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(5000) }).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null &&
      "${compose[@]}" exec -T web wget -q -T 5 -O /dev/null http://127.0.0.1/ 2>/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}

keep_running_images() {
  local service image
  for service in "${built[@]}"; do
    if image=$(docker inspect --format '{{.Image}}' "marauder-$service" 2>/dev/null); then
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

applied_migrations() {
  "${compose[@]}" exec -T timescaledb psql -U marauder -d marauder -tAc \
    "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null || echo none
}

release() {
  if [ "$migrating" = yes ]; then
    say "this release migrates the database, so the running api stops first"
    "${compose[@]}" stop api || return 1
  fi
  "${compose[@]}" run --rm --no-deps api ./node_modules/.bin/prisma migrate deploy &&
    "${compose[@]}" up -d --remove-orphans
}

give_up() {
  say "$1, so the running app was left as it was"
  git reset --hard --quiet "$previous"
  restore_running_images
  exit 1
}

roll_back() {
  if [ "$(applied_migrations)" != "$applied_before" ]; then
    say "$1, and this release migrated the database, which the code it replaced can't read"
    say "fix forward, or restore the predeploy dump from the backups volume as the README describes"
    exit 1
  fi
  say "$1, rolling back to $(git rev-parse --short "$previous") and the images that were running"
  if [ "$migrating" = yes ]; then
    say "the migration did not change the database, but prisma may have recorded it as failed:" \
      "check ${compose[*]} run --rm api ./node_modules/.bin/prisma migrate status before the next deploy"
  fi
  git reset --hard --quiet "$previous"
  restore_running_images
  if "${compose[@]}" up -d --remove-orphans && healthy; then
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
status=$("${compose[@]}" run --rm --no-deps api ./node_modules/.bin/prisma migrate status 2>&1) || true
case "$status" in
  *"Database schema is up to date"*) migrating=no ;;
  *"have not yet been applied"*) migrating=yes ;;
  *)
    printf '%s\n' "$status"
    give_up "could not tell whether the database is up to date"
    ;;
esac
applied_before=$(applied_migrations)

release || roll_back "the release did not finish"

say "waiting for the api and the web app to answer"
if healthy; then
  say "deployed $(git log --oneline -1)"
  exit 0
fi
roll_back "not healthy"

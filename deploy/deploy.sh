#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

compose=(docker compose -f docker-compose.prod.yml)
built=(api web simulator)

say() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

healthy() {
  for _ in $(seq 1 60); do
    if "${compose[@]}" exec -T api node -e \
      "fetch('http://localhost:3001/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null &&
      "${compose[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null; then
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
      docker tag "$image" "marauder-$service:previous"
    fi
  done
}

restore_running_images() {
  local service
  for service in "${built[@]}"; do
    if docker image inspect "marauder-$service:previous" >/dev/null 2>&1; then
      docker tag "marauder-$service:previous" "marauder-$service"
    fi
  done
}

settings_accepted() {
  "${compose[@]}" run --rm --no-deps api node dist/check-config.js &&
    "${compose[@]}" run --rm --no-deps simulator node dist/check-config.js
}

migrations_pending() {
  ! "${compose[@]}" run --rm --no-deps api ./node_modules/.bin/prisma migrate status >/dev/null 2>&1
}

release() {
  "${compose[@]}" up -d timescaledb || return 1
  if [ "$migrating" = yes ]; then
    say "this release migrates the database, so the running api stops first"
    "${compose[@]}" stop api || return 1
  fi
  "${compose[@]}" run --rm --no-deps api ./node_modules/.bin/prisma migrate deploy &&
    "${compose[@]}" up -d --remove-orphans
}

give_up() {
  say "$1, so nothing was restarted"
  git reset --hard --quiet "$previous"
  restore_running_images
  exit 1
}

roll_back() {
  if [ "$migrating" = yes ]; then
    say "$1, and this release migrated the database, which the code it replaced can't read"
    say "fix forward, or restore the predeploy dump from the backups volume as the README describes"
    exit 1
  fi
  say "$1, rolling back to $(git rev-parse --short "$previous") and the images that were running"
  git reset --hard --quiet "$previous"
  restore_running_images
  if release && healthy; then
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

keep_running_images
"${compose[@]}" build || give_up "the build failed"

say "checking deploy/.env against the new release before anything restarts"
settings_accepted || give_up "the new release refuses the settings named above"

"${compose[@]}" up -d timescaledb
migrating=no
if migrations_pending; then
  migrating=yes
fi

release || roll_back "the release did not finish"

say "waiting for the api and the web app to answer"
if healthy; then
  say "deployed $(git log --oneline -1)"
  exit 0
fi
roll_back "not healthy"

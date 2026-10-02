#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

compose=(docker compose -f docker-compose.prod.yml)

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

release() {
  "${compose[@]}" build
  "${compose[@]}" up -d timescaledb
  "${compose[@]}" run --rm --no-deps api sh -c "pnpm exec prisma migrate deploy"
  "${compose[@]}" up -d --remove-orphans
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

release

say "waiting for the api and the web app to answer"
if healthy; then
  say "deployed $(git log --oneline -1)"
  exit 0
fi

say "not healthy, rolling the code back to $(git rev-parse --short "$previous")"
git reset --hard --quiet "$previous"
release
if healthy; then
  say "rolled back to $(git log --oneline -1)"
else
  say "still not healthy after the rollback; look at: ${compose[*]} logs --tail 50"
fi
exit 1

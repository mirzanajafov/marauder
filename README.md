# Marauder

[![CI](https://github.com/mirzanajafov/marauder/actions/workflows/ci.yml/badge.svg)](https://github.com/mirzanajafov/marauder/actions/workflows/ci.yml)

**Live demo:** [marauder.najafov.dev](https://marauder.najafov.dev) — the map is open to watch; naming people needs the admin password.

Real-time indoor positioning for opt-in tags. I built it to see how far you can
push RSSI-based tracking with a clean streaming pipeline: fixed BLE/Wi-Fi tags
report to fixed receivers, and the backend turns that noisy stream into live dots
moving on a floor plan.

The use case is a workplace: staff and assets moving around a building in real time,
each shown by name on the floor plan. The tracked things carry a tag on purpose —
think a staff badge or an asset tag — not phones tracked without consent.

![Live tracking on the floor plan](assets/marauder-demo.gif)

## How it works

A receiver sees a tag and publishes `{ fingerprint, receiverId, rssi, txPower, ts }`
over MQTT. The API resolves the fingerprint to an entity (creating an "unknown"
one the first time), estimates a position from the RSSI readings across receivers,
and streams batched position updates to the web UI over WebSocket. When a new tag
appears you tag it with a name once; after that it is recognized instantly from a
Redis lookup.

Positions come from a log-distance path-loss model, trilateration when three or
more receivers hear a tag, and an exponential moving average to keep markers from
jumping. History goes into a TimescaleDB hypertable so you can replay a session.

## How accurate it is

For a long time I judged this by watching the map, which says nothing. The simulator
knows where every tag really is, so the error in metres is cheap to measure.
`pnpm --filter @marauder/api bench:accuracy` replays the simulator's world with a fixed
seed on a virtual clock (6 tags walking between rooms for 30 minutes), feeds the API's own
tracker, and compares every 150 ms update with where the tag actually was. Every variant
sees the identical signal stream, and the numbers land in `apps/api/bench/accuracy.json`.

Median / p95 error in metres:

| | 1.2 dB noise (simulator default) | 3 dB | 6 dB | 3 dB, wrong path-loss exponent |
| --- | --- | --- | --- | --- |
| nearest receiver | 7.81 / 13.60 | 7.81 / 15.02 | 8.34 / 19.65 | 7.81 / 14.64 |
| weighted centroid | 3.58 / 5.97 | 3.98 / 7.82 | 5.39 / 12.83 | 3.96 / 7.23 |
| trilateration, raw | 2.00 / 4.60 | 4.92 / 11.66 | 9.28 / 22.10 | 6.95 / 29.17 |
| trilateration + EMA (live) | 1.01 / 1.95 | 1.88 / 4.06 | 3.59 / 7.90 | 3.56 / 20.11 |

About a metre at the simulator's noise level, but 1.2 dB is kinder than any real building.
Two things surprised me. From 3 dB up, raw trilateration is worse than a plain weighted
centroid, and at 6 dB a quarter of its answers land outside the building; the smoothing is
doing most of the work. And when the building's path-loss exponent is 3.0 while the solver
assumes 2.5, the live output sits outside the building a third of the time. Smoothing can't
fix that, because it's bias, not noise, and it's the case real sensors would hit first:
nobody knows their building's exponent exactly.

These numbers are a floor, not a promise. The simulator draws RSSI from the same
log-distance model the solver inverts, with Gaussian noise, no multipath and no walls in
the radio path.

## Stack

- NestJS + TypeScript API
- MQTT (Mosquitto) for signal ingest
- Redis for fingerprint resolution, caching, and Socket.IO scale-out
- JWT auth guarding the write endpoints
- TimescaleDB for position history
- React + Vite map UI
- A simulator that generates realistic noisy receiver traffic, so you can run the
  whole thing without hardware

## Run it

```
docker compose up -d
pnpm install
pnpm --filter api prisma migrate deploy
pnpm dev
```

Then open the web app, watch tags appear as "unknown", and name one. Restart the
simulator and it comes back already named. Tagging and the config tab need the admin
password (`ADMIN_PASSWORD`, see `.env.example`); log in from the top bar.

## Deploying

The live demo runs from `deploy/docker-compose.prod.yml` on a small VPS, behind a
Caddy that several of my projects share. Nothing publishes a port; the web container
joins that proxy's `edge` network. A release is `deploy/deploy.sh`: it backs up,
fast-forwards to `origin/main`, rebuilds, runs the migrations, and waits for the API
and the web app to answer. If they don't, it resets to the commit it started from and
rebuilds that.

The backup container dumps the database every night and keeps two weeks. I leave the
position history out on purpose. It is simulator traffic that refills itself within
minutes, and keeping it made a 3 GB volume out of what is really a few kilobytes of
names, floor plans and receivers. Restoring one into an empty database:

```
docker exec marauder-timescaledb psql -U marauder -c "SELECT timescaledb_pre_restore();"
docker exec -i marauder-timescaledb pg_restore -U marauder -d marauder --no-owner < marauder-<time>.dump
docker exec marauder-timescaledb psql -U marauder -c "SELECT timescaledb_post_restore();"
```

## Layout

- `apps/api` — NestJS backend
- `apps/simulator` — MQTT traffic generator
- `apps/web` — map + admin UI
- `packages/shared` — shared types

## Real sensors

The map is fed over MQTT, so any receiver that publishes `sensors/<receiverId>/signals`
with `{ fingerprint, receiverId, rssi, txPower }` works — the simulator is just one
source. Two reference receivers live in `hardware/`:

- `hardware/esp32-receiver` — an ESP32 sketch (PlatformIO) that BLE-scans and publishes
  RSSI. Set the wifi, MQTT host and `RECEIVER_ID` at the top, flash three boards placed
  apart, and register them in the config tab.
- `hardware/ble-scanner` — a cross-platform Python scanner for a laptop or Raspberry Pi.
  Install with `pip install -r requirements.txt`, then run
  `MQTT_HOST=... RECEIVER_ID=R1 python scanner.py`.

Use fixed-id BLE beacons (or a phone in beacon mode) as tags; each shows up as unknown
until you name it. Set each receiver's position in the config tab and tune
`PATH_LOSS_EXPONENT` and txPower for your space.

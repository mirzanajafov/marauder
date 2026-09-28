# Marauder

Real-time indoor positioning for opt-in tags. I built it to see how far you can
push RSSI-based tracking with a clean streaming pipeline: fixed BLE/Wi-Fi tags
report to fixed receivers, and the backend turns that noisy stream into live dots
moving on a floor plan.

The idea comes from the Marauder's Map: named markers gliding around a building in
real time. Here the named things are tags people or assets carry on purpose, not
phones tracked without consent.

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

## Layout

- `apps/api` — NestJS backend
- `apps/simulator` — MQTT traffic generator
- `apps/web` — map + admin UI
- `packages/shared` — shared types

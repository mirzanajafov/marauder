import mqtt from 'mqtt';
import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_TX_POWER,
  FLOOR,
  RawSignal,
  signalTopic,
} from '@marauder/shared';

interface Tag {
  fingerprint: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const TAG_COUNT = Number(process.env.TAG_COUNT ?? 6) || 6;
const HZ = Number(process.env.SIM_HZ ?? 10) || 10;
const SPEED = Number(process.env.SIM_SPEED ?? 1.5) || 1.5;
const NOISE_DB = Number(process.env.SIM_NOISE_DB ?? 2.5) || 2.5;
const DROP_PROB = Number(process.env.SIM_DROP_PROB ?? 0.08);
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

function randomWaypoint(): { x: number; y: number } {
  return { x: Math.random() * FLOOR.width, y: Math.random() * FLOOR.height };
}

function gaussian(sd: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function makeTags(): Tag[] {
  const tags: Tag[] = [];
  for (let i = 0; i < TAG_COUNT; i++) {
    const start = randomWaypoint();
    const wp = randomWaypoint();
    tags.push({
      fingerprint: `tag-${String(i + 1).padStart(2, '0')}`,
      x: start.x,
      y: start.y,
      tx: wp.x,
      ty: wp.y,
    });
  }
  return tags;
}

function step(tag: Tag, dt: number): void {
  const dx = tag.tx - tag.x;
  const dy = tag.ty - tag.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) {
    const wp = randomWaypoint();
    tag.tx = wp.x;
    tag.ty = wp.y;
    return;
  }
  const move = Math.min(SPEED * dt, dist);
  tag.x += (dx / dist) * move;
  tag.y += (dy / dist) * move;
}

function main(): void {
  const client = mqtt.connect(MQTT_URL);
  const tags = makeTags();
  const dt = 1 / HZ;

  client.on('connect', () => {
    console.log(`simulator connected: ${tags.length} tags, ${DEFAULT_RECEIVERS.length} receivers, ${HZ} Hz`);
    setInterval(() => {
      const now = Date.now();
      for (const tag of tags) {
        step(tag, dt);
        for (const r of DEFAULT_RECEIVERS) {
          if (Math.random() < DROP_PROB) {
            continue;
          }
          const d = Math.max(0.1, Math.hypot(tag.x - r.x, tag.y - r.y));
          const rssi = DEFAULT_TX_POWER - 10 * DEFAULT_PATH_LOSS_EXPONENT * Math.log10(d) + gaussian(NOISE_DB);
          const signal: RawSignal = {
            fingerprint: tag.fingerprint,
            receiverId: r.id,
            rssi: Math.round(rssi * 10) / 10,
            txPower: DEFAULT_TX_POWER,
            ts: now,
          };
          client.publish(signalTopic(r.id), JSON.stringify(signal));
        }
      }
    }, Math.round(1000 / HZ));
  });

  client.on('error', (err) => console.error(err.message));
}

main();

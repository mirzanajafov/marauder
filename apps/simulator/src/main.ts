import mqtt from 'mqtt';
import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_TX_POWER,
  NavNode,
  RawSignal,
  signalTopic,
} from '@marauder/shared';

interface Tag {
  fingerprint: string;
  x: number;
  y: number;
  from: string;
  to: string;
}

const TAG_COUNT = Number(process.env.TAG_COUNT ?? 6) || 6;
const HZ = Number(process.env.SIM_HZ ?? 10) || 10;
const SPEED = Number(process.env.SIM_SPEED ?? 1.4) || 1.4;
const NOISE_DB = Number(process.env.SIM_NOISE_DB ?? 1.8) || 1.8;
const DROP_PROB = Number(process.env.SIM_DROP_PROB ?? 0.08);
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

const nodeById = new Map<string, NavNode>(DEFAULT_SCENE.nodes.map((n) => [n.id, n]));
const adjacency = new Map<string, string[]>();
for (const node of DEFAULT_SCENE.nodes) {
  adjacency.set(node.id, []);
}
for (const [a, b] of DEFAULT_SCENE.edges) {
  adjacency.get(a)?.push(b);
  adjacency.get(b)?.push(a);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function gaussian(sd: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function makeTags(): Tag[] {
  const ids = DEFAULT_SCENE.nodes.map((n) => n.id);
  const tags: Tag[] = [];
  for (let i = 0; i < TAG_COUNT; i++) {
    const from = pick(ids);
    const neighbors = adjacency.get(from) ?? [];
    const to = neighbors.length > 0 ? pick(neighbors) : from;
    const start = nodeById.get(from);
    tags.push({
      fingerprint: `tag-${String(i + 1).padStart(2, '0')}`,
      x: start ? start.x : 20,
      y: start ? start.y : 12.5,
      from,
      to,
    });
  }
  return tags;
}

function step(tag: Tag, dt: number): void {
  const target = nodeById.get(tag.to);
  if (!target) {
    return;
  }
  const dx = target.x - tag.x;
  const dy = target.y - tag.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.2) {
    tag.x = target.x;
    tag.y = target.y;
    const neighbors = adjacency.get(tag.to) ?? [];
    const forward = neighbors.filter((n) => n !== tag.from);
    tag.from = tag.to;
    tag.to = forward.length > 0 ? pick(forward) : neighbors.length > 0 ? pick(neighbors) : tag.to;
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
    console.log(`simulator connected: ${tags.length} tags walking ${DEFAULT_SCENE.edges.length} corridors, ${HZ} Hz`);
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

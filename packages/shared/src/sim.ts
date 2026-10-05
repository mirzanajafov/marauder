import type { FloorScene, NavNode, RawSignal, Receiver } from './index';

export type Random = () => number;

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: Random, sd: number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

export interface SimTag {
  fingerprint: string;
  x: number;
  y: number;
  at: string;
  path: string[];
  step: number;
  dwellUntil: number;
  moving: boolean;
}

export interface WorldOptions {
  scene: FloorScene;
  receivers: Receiver[];
  tagCount: number;
  speed: number;
  noiseDb: number;
  dropProb: number;
  dwellMinMs: number;
  dwellMaxMs: number;
  txPower: number;
  pathLossExponent: number;
  random: Random;
}

export interface World {
  tags: SimTag[];
  rooms: string[];
  advance(dt: number, now: number): void;
  signals(now: number): RawSignal[];
}

export function createWorld(options: WorldOptions): World {
  const { scene, random } = options;
  const nodeById = new Map<string, NavNode>(scene.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const node of scene.nodes) {
    adjacency.set(node.id, []);
  }
  for (const [a, b] of scene.edges) {
    adjacency.get(a)?.push(b);
    adjacency.get(b)?.push(a);
  }
  const rooms = scene.nodes.map((n) => n.id).filter((id) => id.startsWith('room-'));

  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  const shortestPath = (from: string, to: string): string[] => {
    if (from === to) {
      return [from];
    }
    const prev = new Map<string, string>();
    const seen = new Set<string>([from]);
    const queue: string[] = [from];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      for (const nb of adjacency.get(cur) ?? []) {
        if (seen.has(nb)) {
          continue;
        }
        seen.add(nb);
        prev.set(nb, cur);
        if (nb === to) {
          const path = [to];
          let c = to;
          while (prev.has(c)) {
            c = prev.get(c) as string;
            path.unshift(c);
          }
          return path;
        }
        queue.push(nb);
      }
    }
    return [from];
  };

  const nextDestination = (from: string): { path: string[]; step: number } => {
    const choices = rooms.filter((r) => r !== from);
    const dest = choices.length > 0 ? pick(choices) : from;
    return { path: shortestPath(from, dest), step: 1 };
  };

  const tags: SimTag[] = [];
  for (let i = 0; i < options.tagCount; i++) {
    const at = pick(rooms);
    const start = nodeById.get(at);
    const plan = nextDestination(at);
    tags.push({
      fingerprint: `tag-${String(i + 1).padStart(2, '0')}`,
      x: start ? start.x : scene.width / 2,
      y: start ? start.y : scene.height / 2,
      at,
      path: plan.path,
      step: plan.step,
      dwellUntil: 0,
      moving: false,
    });
  }

  const step = (tag: SimTag, dt: number, now: number): void => {
    tag.moving = false;
    if (now < tag.dwellUntil) {
      return;
    }
    if (tag.step >= tag.path.length) {
      tag.dwellUntil = now + options.dwellMinMs + random() * (options.dwellMaxMs - options.dwellMinMs);
      const plan = nextDestination(tag.at);
      tag.path = plan.path;
      tag.step = plan.step;
      return;
    }
    const target = nodeById.get(tag.path[tag.step]);
    if (!target) {
      tag.step += 1;
      return;
    }
    const dx = target.x - tag.x;
    const dy = target.y - tag.y;
    const dist = Math.hypot(dx, dy);
    tag.moving = true;
    if (dist < 0.2) {
      tag.x = target.x;
      tag.y = target.y;
      tag.at = tag.path[tag.step];
      tag.step += 1;
      return;
    }
    const move = Math.min(options.speed * dt, dist);
    tag.x += (dx / dist) * move;
    tag.y += (dy / dist) * move;
  };

  return {
    tags,
    rooms,
    advance(dt, now) {
      for (const tag of tags) {
        step(tag, dt, now);
      }
    },
    signals(now) {
      const out: RawSignal[] = [];
      for (const tag of tags) {
        for (const r of options.receivers) {
          if (random() < options.dropProb) {
            continue;
          }
          const d = Math.max(0.1, Math.hypot(tag.x - r.x, tag.y - r.y));
          const rssi =
            options.txPower - 10 * options.pathLossExponent * Math.log10(d) + gaussian(random, options.noiseDb);
          out.push({
            fingerprint: tag.fingerprint,
            receiverId: r.id,
            rssi: Math.round(rssi * 10) / 10,
            txPower: options.txPower,
            ts: now,
          });
        }
      }
      return out;
    },
  };
}

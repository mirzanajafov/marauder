import { DEFAULT_PATH_LOSS_EXPONENT, DEFAULT_TX_POWER, isReportableDbm } from './radio';
import { DEFAULT_RECEIVERS, DEFAULT_SCENE, FloorScene, NavNode } from './scene';
import { Receiver, SignalPayload } from './domain';

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

function gaussian(random: Random, sd: number): number {
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
  receiverBiasDb?: number;
  random: Random;
}

export type Traffic = Pick<WorldOptions, 'tagCount' | 'speed' | 'noiseDb' | 'dropProb' | 'dwellMinMs' | 'dwellMaxMs'>;

export const DEFAULT_SIM_HZ = 10;

export function tickMs(hz: number): number {
  return Math.round(1000 / hz);
}

export const DEFAULT_TRAFFIC: Readonly<Traffic> = {
  tagCount: 6,
  speed: 1.4,
  noiseDb: 1.2,
  dropProb: 0.08,
  dwellMinMs: 2500,
  dwellMaxMs: 7000,
};

export interface World {
  tags: SimTag[];
  rooms: string[];
  advance(dt: number, now: number): void;
  signals(): SignalPayload[];
}

function createWorld(options: WorldOptions): World {
  const { scene, random } = options;
  const nodeById = new Map<string, NavNode>(scene.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const node of scene.nodes) {
    adjacency.set(node.id, []);
  }
  for (const [a, b] of scene.edges) {
    const fromA = adjacency.get(a);
    const fromB = adjacency.get(b);
    if (!fromA || !fromB) {
      throw new Error(`the scene has an edge from ${a} to ${b}, but not both nodes`);
    }
    fromA.push(b);
    fromB.push(a);
  }
  const rooms = scene.nodes.map((n) => n.id).filter((id) => id.startsWith('room-'));
  if (rooms.length === 0) {
    throw new Error('the scene has no room- nodes for the tags to walk between');
  }

  const requireNode = (id: string): NavNode => {
    const found = nodeById.get(id);
    if (!found) {
      throw new Error(`the scene has no navigation node ${id}`);
    }
    return found;
  };

  const pick = <T>(items: T[]): T => {
    if (items.length === 0) {
      throw new Error('cannot pick from an empty list');
    }
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) {
      throw new Error('the random source returned a number outside [0, 1)');
    }
    return item;
  };

  const shortestPath = (from: string, to: string): string[] => {
    if (from === to) {
      return [from];
    }
    const prev = new Map<string, string>();
    const seen = new Set<string>([from]);
    const queue: string[] = [from];
    for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) {
          continue;
        }
        seen.add(next);
        prev.set(next, current);
        if (next === to) {
          const path = [to];
          for (let back = prev.get(to); back !== undefined; back = prev.get(back)) {
            path.unshift(back);
          }
          return path;
        }
        queue.push(next);
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
    const start = requireNode(at);
    const plan = nextDestination(at);
    tags.push({
      fingerprint: `tag-${String(i + 1).padStart(2, '0')}`,
      x: start.x,
      y: start.y,
      at,
      path: plan.path,
      step: plan.step,
      dwellUntil: 0,
      moving: false,
    });
  }

  const bias = new Map<string, number>();
  if (options.receiverBiasDb) {
    for (const r of options.receivers) {
      bias.set(r.id, gaussian(random, options.receiverBiasDb));
    }
  }

  const step = (tag: SimTag, dt: number, now: number): void => {
    tag.moving = false;
    if (now < tag.dwellUntil) {
      return;
    }
    const targetId = tag.path[tag.step];
    if (targetId === undefined) {
      tag.dwellUntil = now + options.dwellMinMs + random() * (options.dwellMaxMs - options.dwellMinMs);
      const plan = nextDestination(tag.at);
      tag.path = plan.path;
      tag.step = plan.step;
      return;
    }
    const target = requireNode(targetId);
    const dx = target.x - tag.x;
    const dy = target.y - tag.y;
    const dist = Math.hypot(dx, dy);
    tag.moving = true;
    if (dist < 0.2) {
      tag.x = target.x;
      tag.y = target.y;
      tag.at = targetId;
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
    signals() {
      const out: SignalPayload[] = [];
      for (const tag of tags) {
        for (const r of options.receivers) {
          if (random() < options.dropProb) {
            continue;
          }
          const d = Math.max(0.1, Math.hypot(tag.x - r.x, tag.y - r.y));
          const rssi =
            options.txPower -
            10 * options.pathLossExponent * Math.log10(d) +
            (bias.get(r.id) ?? 0) +
            gaussian(random, options.noiseDb);
          const reported = Math.round(rssi * 10) / 10;
          if (!isReportableDbm(reported)) {
            continue;
          }
          out.push({
            fingerprint: tag.fingerprint,
            receiverId: r.id,
            rssi: reported,
            txPower: options.txPower,
          });
        }
      }
      return out;
    },
  };
}

export function createDefaultWorld(options: Partial<WorldOptions> & Pick<WorldOptions, 'random'>): World {
  return createWorld({
    ...DEFAULT_TRAFFIC,
    scene: DEFAULT_SCENE,
    receivers: DEFAULT_RECEIVERS,
    txPower: DEFAULT_TX_POWER,
    pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
    ...options,
  });
}

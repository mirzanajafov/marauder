export type EntityStatus = 'unknown' | 'tagged';

export interface RawSignal {
  fingerprint: string;
  receiverId: string;
  rssi: number;
  txPower: number;
  ts: number;
}

export interface Receiver {
  id: string;
  name: string;
  x: number;
  y: number;
  floor: number;
}

export interface Entity {
  id: string;
  fingerprint: string;
  name: string | null;
  kind: string | null;
  status: EntityStatus;
  firstSeen: number;
  lastSeen: number;
}

export interface Position {
  entityId: string;
  x: number;
  y: number;
  accuracy: number;
  ts: number;
}

export interface PositionUpdate extends Position {
  name: string | null;
  status: EntityStatus;
  kind: string | null;
}

export const SIGNAL_TOPIC_WILDCARD = 'sensors/+/signals';

export function signalTopic(receiverId: string): string {
  return `sensors/${receiverId}/signals`;
}

export function receiverIdFromTopic(topic: string): string | null {
  const parts = topic.split('/');
  if (parts.length === 3 && parts[0] === 'sensors' && parts[2] === 'signals') {
    return parts[1];
  }
  return null;
}

export const WsEvents = {
  EntityDiscovered: 'entity.discovered',
  EntityUpdated: 'entity.updated',
  PositionsBatch: 'positions.batch',
} as const;

export interface EntityDiscoveredEvent {
  entity: Entity;
}

export interface EntityUpdatedEvent {
  entity: Entity;
}

export interface PositionsBatchEvent {
  positions: PositionUpdate[];
}

export interface TagEntityInput {
  name: string;
  kind?: string;
}

export const FLOOR = { width: 40, height: 25 };

export const DEFAULT_RECEIVERS: Receiver[] = [
  { id: 'R1', name: 'NW', x: 0, y: 0, floor: 0 },
  { id: 'R2', name: 'NE', x: 40, y: 0, floor: 0 },
  { id: 'R3', name: 'SW', x: 0, y: 25, floor: 0 },
  { id: 'R4', name: 'SE', x: 40, y: 25, floor: 0 },
  { id: 'R5', name: 'C', x: 20, y: 12.5, floor: 0 },
];

export const DEFAULT_TX_POWER = -59;
export const DEFAULT_PATH_LOSS_EXPONENT = 2.5;

export interface HistorySummary {
  from: string | null;
  to: string | null;
  count: number;
}

export interface HistoryPoint {
  entityId: string;
  x: number;
  y: number;
  accuracy: number;
  time: number;
  name: string | null;
  status: EntityStatus;
}

export interface FloorPlan {
  imageUrl: string | null;
  width: number;
  height: number;
  floor: number;
}

export const DEFAULT_FLOORPLAN_ID = 'default';

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

export interface Furniture {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorScene {
  width: number;
  height: number;
  walls: Wall[];
  nodes: NavNode[];
  edges: [string, string][];
  rooms: Room[];
  furniture: Furniture[];
}

function segmentsWithGaps(from: number, to: number, gaps: [number, number][]): [number, number][] {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = from;
  for (const [g0, g1] of sorted) {
    if (g1 < cur) {
      continue;
    }
    if (g0 > cur) {
      out.push([cur, Math.min(g0, to)]);
    }
    cur = Math.max(cur, g1);
    if (cur >= to) {
      break;
    }
  }
  if (cur < to) {
    out.push([cur, to]);
  }
  return out;
}

function buildScene(): FloorScene {
  const width = 40;
  const height = 25;
  const yTop = 11;
  const yBot = 14;
  const doorHalf = 0.7;
  const topDoors = [6.5, 16, 24, 33];
  const botDoors = [5, 16, 26, 35];
  const topSplits = [12, 20, 28];
  const botSplits = [10, 22, 31];
  const entrance: [number, number] = [14, 18];

  const walls: Wall[] = [
    { x1: 1, y1: 1, x2: 39, y2: 1 },
    { x1: 1, y1: 1, x2: 1, y2: 24 },
    { x1: 39, y1: 1, x2: 39, y2: 24 },
  ];
  for (const [a, b] of segmentsWithGaps(1, 39, [entrance])) {
    walls.push({ x1: a, y1: 24, x2: b, y2: 24 });
  }
  for (const [a, b] of segmentsWithGaps(1, 39, topDoors.map((x) => [x - doorHalf, x + doorHalf]))) {
    walls.push({ x1: a, y1: yTop, x2: b, y2: yTop });
  }
  for (const [a, b] of segmentsWithGaps(1, 39, botDoors.map((x) => [x - doorHalf, x + doorHalf]))) {
    walls.push({ x1: a, y1: yBot, x2: b, y2: yBot });
  }
  for (const x of topSplits) {
    walls.push({ x1: x, y1: 1, x2: x, y2: yTop });
  }
  for (const x of botSplits) {
    walls.push({ x1: x, y1: yBot, x2: x, y2: 24 });
  }

  const nodes: NavNode[] = [
    { id: 'c-a', x: 3, y: 12.5 },
    { id: 'c1', x: 5, y: 12.5 },
    { id: 'c2', x: 6.5, y: 12.5 },
    { id: 'c3', x: 16, y: 12.5 },
    { id: 'c4', x: 24, y: 12.5 },
    { id: 'c5', x: 26, y: 12.5 },
    { id: 'c6', x: 33, y: 12.5 },
    { id: 'c7', x: 35, y: 12.5 },
    { id: 'c-b', x: 37, y: 12.5 },
    { id: 'room-meeting', x: 6.5, y: 6 },
    { id: 'room-office1', x: 16, y: 6 },
    { id: 'room-office2', x: 24, y: 6 },
    { id: 'room-open', x: 33, y: 6 },
    { id: 'room-kitchen', x: 5, y: 19 },
    { id: 'room-reception', x: 16, y: 19 },
    { id: 'room-lab', x: 26, y: 19 },
    { id: 'room-server', x: 35, y: 19 },
  ];
  const edges: [string, string][] = [
    ['c-a', 'c1'],
    ['c1', 'c2'],
    ['c2', 'c3'],
    ['c3', 'c4'],
    ['c4', 'c5'],
    ['c5', 'c6'],
    ['c6', 'c7'],
    ['c7', 'c-b'],
    ['room-meeting', 'c2'],
    ['room-office1', 'c3'],
    ['room-office2', 'c4'],
    ['room-open', 'c6'],
    ['room-kitchen', 'c1'],
    ['room-reception', 'c3'],
    ['room-lab', 'c5'],
    ['room-server', 'c7'],
  ];
  const rooms: Room[] = [
    { x: 1, y: 1, w: 11, h: 10, name: 'Meeting' },
    { x: 12, y: 1, w: 8, h: 10, name: 'Office' },
    { x: 20, y: 1, w: 8, h: 10, name: 'Office' },
    { x: 28, y: 1, w: 11, h: 10, name: 'Open Space' },
    { x: 1, y: 14, w: 9, h: 10, name: 'Kitchen' },
    { x: 10, y: 14, w: 12, h: 10, name: 'Reception' },
    { x: 22, y: 14, w: 9, h: 10, name: 'Lab' },
    { x: 31, y: 14, w: 8, h: 10, name: 'Server' },
  ];
  const furniture: Furniture[] = [
    { x: 3, y: 3.5, w: 6, h: 3 },
    { x: 13, y: 2.5, w: 2.6, h: 1.4 },
    { x: 16.4, y: 7.5, w: 2.6, h: 1.4 },
    { x: 21, y: 2.5, w: 2.6, h: 1.4 },
    { x: 24.4, y: 7.5, w: 2.6, h: 1.4 },
    { x: 29, y: 2.5, w: 2.4, h: 1.3 },
    { x: 32.3, y: 2.5, w: 2.4, h: 1.3 },
    { x: 35.6, y: 2.5, w: 2.4, h: 1.3 },
    { x: 29, y: 8.2, w: 2.4, h: 1.3 },
    { x: 35.6, y: 8.2, w: 2.4, h: 1.3 },
    { x: 2, y: 21.3, w: 6, h: 1.3 },
    { x: 11.5, y: 20, w: 5, h: 1.6 },
    { x: 23, y: 15.5, w: 6.5, h: 1.2 },
    { x: 23, y: 21.3, w: 6.5, h: 1.2 },
    { x: 32, y: 15.2, w: 1.6, h: 3 },
    { x: 35.4, y: 15.2, w: 1.6, h: 3 },
  ];
  return { width, height, walls, nodes, edges, rooms, furniture };
}

export const DEFAULT_SCENE: FloorScene = buildScene();

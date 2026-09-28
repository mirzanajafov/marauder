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

export interface FloorScene {
  width: number;
  height: number;
  walls: Wall[];
  nodes: NavNode[];
  edges: [string, string][];
}

function buildScene(): FloorScene {
  const width = 40;
  const height = 25;
  const doorXs = [5, 14.5, 25.5, 34.5];
  const doorHalf = 0.6;
  const yTop = 11.5;
  const yBot = 13.5;
  const xL = 19;
  const xR = 21;
  const splitXs = [10, 30];
  const walls: Wall[] = [
    { x1: 1, y1: 1, x2: 39, y2: 1 },
    { x1: 1, y1: 24, x2: 39, y2: 24 },
    { x1: 1, y1: 1, x2: 1, y2: 24 },
    { x1: 39, y1: 1, x2: 39, y2: 24 },
  ];
  const gaps: [number, number][] = doorXs
    .map((x) => [x - doorHalf, x + doorHalf] as [number, number])
    .concat([[xL, xR]])
    .sort((a, b) => a[0] - b[0]);
  const segments = (from: number, to: number): [number, number][] => {
    const out: [number, number][] = [];
    let cur = from;
    for (const [g0, g1] of gaps) {
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
  };
  for (const y of [yTop, yBot]) {
    for (const [a, b] of segments(1, 39)) {
      walls.push({ x1: a, y1: y, x2: b, y2: y });
    }
  }
  for (const x of [xL, xR]) {
    walls.push({ x1: x, y1: 1, x2: x, y2: yTop });
    walls.push({ x1: x, y1: yBot, x2: x, y2: 24 });
  }
  for (const x of splitXs) {
    walls.push({ x1: x, y1: 1, x2: x, y2: yTop });
    walls.push({ x1: x, y1: yBot, x2: x, y2: 24 });
  }
  const nodes: NavNode[] = [
    { id: 'H1', x: 3, y: 12.5 },
    { id: 'H2', x: 5, y: 12.5 },
    { id: 'H3', x: 14.5, y: 12.5 },
    { id: 'CX', x: 20, y: 12.5 },
    { id: 'H5', x: 25.5, y: 12.5 },
    { id: 'H6', x: 34.5, y: 12.5 },
    { id: 'H7', x: 37, y: 12.5 },
    { id: 'V1', x: 20, y: 3 },
    { id: 'V3', x: 20, y: 22 },
    { id: 'TL1', x: 5, y: 6 },
    { id: 'TL2', x: 14.5, y: 6 },
    { id: 'TR1', x: 25.5, y: 6 },
    { id: 'TR2', x: 34.5, y: 6 },
    { id: 'BL1', x: 5, y: 19 },
    { id: 'BL2', x: 14.5, y: 19 },
    { id: 'BR1', x: 25.5, y: 19 },
    { id: 'BR2', x: 34.5, y: 19 },
  ];
  const edges: [string, string][] = [
    ['H1', 'H2'],
    ['H2', 'H3'],
    ['H3', 'CX'],
    ['CX', 'H5'],
    ['H5', 'H6'],
    ['H6', 'H7'],
    ['V1', 'CX'],
    ['CX', 'V3'],
    ['TL1', 'H2'],
    ['TL2', 'H3'],
    ['TR1', 'H5'],
    ['TR2', 'H6'],
    ['BL1', 'H2'],
    ['BL2', 'H3'],
    ['BR1', 'H5'],
    ['BR2', 'H6'],
  ];
  return { width, height, walls, nodes, edges };
}

export const DEFAULT_SCENE: FloorScene = buildScene();

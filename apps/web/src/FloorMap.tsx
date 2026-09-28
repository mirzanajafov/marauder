import { JSX, MouseEvent } from 'react';
import { DEFAULT_SCENE, Entity, PositionUpdate, Receiver, Wall } from '@marauder/shared';

interface Trail {
  x: number;
  y: number;
}

interface Props {
  width: number;
  height: number;
  imageUrl?: string | null;
  walls?: Wall[];
  receivers: Receiver[];
  entities: Record<string, Entity>;
  positions: Record<string, PositionUpdate>;
  trails?: Record<string, Trail[]>;
  onMapClick?: (x: number, y: number) => void;
}

const PAD = 2;
const PALETTE = [
  '#58a6ff',
  '#3fb950',
  '#f0883e',
  '#bc8cff',
  '#ff7b72',
  '#39c5cf',
  '#e3b341',
  '#ff9bce',
  '#7ee787',
  '#d2a8ff',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function FloorMap({ width, height, imageUrl, walls, receivers, entities, positions, trails, onMapClick }: Props) {
  const posList = Object.values(positions);

  const handleClick = (e: MouseEvent<SVGSVGElement>): void => {
    if (!onMapClick) {
      return;
    }
    const svg = e.currentTarget;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return;
    }
    const local = point.matrixTransform(ctm.inverse());
    onMapClick(Math.round(local.x * 10) / 10, Math.round(local.y * 10) / 10);
  };

  return (
    <div className="map">
      <svg
        viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2}`}
        className={onMapClick ? 'floor clickable' : 'floor'}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
      >
        <rect x={0} y={0} width={width} height={height} className="floor-bg" />
        {imageUrl ? (
          <image href={imageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="none" opacity={0.55} />
        ) : walls ? (
          <>
            {DEFAULT_SCENE.furniture.map((f, i) => (
              <rect key={`f${i}`} x={f.x} y={f.y} width={f.w} height={f.h} rx={0.15} className="furniture" />
            ))}
            {walls.map((w, i) => (
              <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className="wall" />
            ))}
            {DEFAULT_SCENE.rooms.map((r, i) => (
              <text key={`r${i}`} x={r.x + r.w / 2} y={r.y + 1.7} className="room-label">
                {r.name}
              </text>
            ))}
          </>
        ) : null}
        {receivers.map((r) => (
          <g key={r.id}>
            <rect x={r.x - 0.4} y={r.y - 0.4} width={0.8} height={0.8} rx={0.18} className="receiver" />
            <text x={r.x} y={r.y - 0.75} className="receiver-label">
              {r.name}
            </text>
          </g>
        ))}
        {posList.map((p) => {
          const entity = entities[p.entityId];
          const color = PALETTE[hashId(p.entityId) % PALETTE.length];
          const label = entity?.name ?? p.name ?? 'Unknown';
          const trail = trails?.[p.entityId] ?? [{ x: p.x, y: p.y }];
          const dy = (((hashId(p.entityId) % 5) - 2) * 1.9);
          const w = label.length * 0.52 + 0.7;
          const lx = p.x + 0.7;
          const ly = p.y - 1.9 + dy;
          return (
            <g key={p.entityId}>
              {footprints(p.entityId, trail, color)}
              <line x1={p.x} y1={p.y} x2={lx + 0.2} y2={ly + 0.65} stroke={color} strokeWidth={0.05} opacity={0.5} />
              <rect x={lx} y={ly} width={w} height={1.3} rx={0.35} fill="#0d1117" opacity={0.85} stroke={color} strokeWidth={0.07} />
              <text x={lx + 0.35} y={ly + 0.9} className="entity-label">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function footprints(id: string, pts: Trail[], color: string): JSX.Element[] {
  const els: JSX.Element[] = [];
  const last = pts.length - 1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const ref = pts[i - 1] ?? pts[i + 1] ?? p;
    const angle = Math.atan2(p.y - ref.y, p.x - ref.x);
    const deg = (angle * 180) / Math.PI;
    const side = i % 2 === 0 ? 1 : -1;
    const ox = Math.cos(angle + Math.PI / 2) * 0.22 * side;
    const oy = Math.sin(angle + Math.PI / 2) * 0.22 * side;
    const head = i === last;
    const opacity = last === 0 ? 0.95 : 0.14 + 0.81 * (i / last);
    const cx = p.x + ox;
    const cy = p.y + oy;
    if (head) {
      els.push(<circle key={`${id}-h`} cx={p.x} cy={p.y} r={0.55} fill={color} opacity={0.13} />);
    }
    els.push(
      <g key={`${id}-${i}`} transform={`translate(${cx} ${cy}) rotate(${deg})`} fill={color} opacity={opacity}>
        <ellipse cx={0.15} cy={0} rx={head ? 0.3 : 0.24} ry={head ? 0.16 : 0.13} />
        <ellipse cx={-0.2} cy={0} rx={head ? 0.13 : 0.11} ry={head ? 0.11 : 0.09} />
      </g>,
    );
  }
  return els;
}

import { JSX, MouseEvent } from 'react';
import { Entity, PositionUpdate, Receiver, Wall } from '@marauder/shared';

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
  '#a5d6ff',
  '#d2a8ff',
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
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
        ) : (
          walls?.map((w, i) => (
            <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className="wall" />
          ))
        )}
        {gridLines(width, height)}
        {receivers.map((r) => (
          <g key={r.id}>
            <rect x={r.x - 0.45} y={r.y - 0.45} width={0.9} height={0.9} className="receiver" />
            <text x={r.x} y={r.y - 0.8} className="receiver-label">
              {r.name}
            </text>
          </g>
        ))}
        {posList.map((p) => {
          const entity = entities[p.entityId];
          const color = colorFor(p.entityId);
          const label = entity?.name ?? p.name ?? 'Unknown';
          const trail = trails?.[p.entityId] ?? [{ x: p.x, y: p.y }];
          return (
            <g key={p.entityId}>
              {footprints(p.entityId, trail, color)}
              <text x={p.x + 0.9} y={p.y - 0.6} className="entity-label" fill={color}>
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
    const ox = Math.cos(angle + Math.PI / 2) * 0.28 * side;
    const oy = Math.sin(angle + Math.PI / 2) * 0.28 * side;
    const opacity = last === 0 ? 0.95 : 0.15 + 0.8 * (i / last);
    const cx = p.x + ox;
    const cy = p.y + oy;
    els.push(
      <g key={`${id}-${i}`} transform={`translate(${cx} ${cy}) rotate(${deg})`} fill={color} opacity={opacity}>
        <ellipse cx={0.17} cy={0} rx={0.3} ry={0.16} />
        <ellipse cx={-0.24} cy={0} rx={0.14} ry={0.11} />
      </g>,
    );
  }
  return els;
}

function gridLines(width: number, height: number): JSX.Element[] {
  const lines: JSX.Element[] = [];
  for (let x = 0; x <= width; x += 5) {
    lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={height} className="grid" />);
  }
  for (let y = 0; y <= height; y += 5) {
    lines.push(<line key={`hy${y}`} x1={0} y1={y} x2={width} y2={y} className="grid" />);
  }
  return lines;
}

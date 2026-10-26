import { MouseEvent } from 'react';
import { DEFAULT_SCENE, FloorPlan, Receiver } from '@marauder/shared';
import { TrailPoint, footsteps } from './trails';

export interface Marker {
  id: string;
  x: number;
  y: number;
  label: string;
  trail: readonly TrailPoint[];
}

interface Props {
  plan: FloorPlan;
  receivers: readonly Receiver[];
  markers: readonly Marker[];
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
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function colorFor(id: string): string {
  return PALETTE[hashId(id) % PALETTE.length] ?? PALETTE[0];
}

export function FloorMap({ plan, receivers, markers, onMapClick }: Props) {
  const reportClickedPoint = (event: MouseEvent<SVGSVGElement>): void => {
    if (!onMapClick) {
      return;
    }
    const ctm = event.currentTarget.getScreenCTM();
    if (!ctm) {
      return;
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    onMapClick(Math.round(point.x * 10) / 10, Math.round(point.y * 10) / 10);
  };

  return (
    <div className="map">
      <svg
        viewBox={`${-PAD} ${-PAD} ${plan.width + PAD * 2} ${plan.height + PAD * 2}`}
        className={onMapClick ? 'floor clickable' : 'floor'}
        preserveAspectRatio="xMidYMid meet"
        onClick={reportClickedPoint}
      >
        <rect x={0} y={0} width={plan.width} height={plan.height} className="floor-bg" />
        {plan.imageUrl ? (
          <image
            href={plan.imageUrl}
            x={0}
            y={0}
            width={plan.width}
            height={plan.height}
            preserveAspectRatio="none"
            opacity={0.55}
          />
        ) : (
          <DefaultScene />
        )}
        {receivers.map((r) => (
          <g key={r.id}>
            <rect x={r.x - 0.4} y={r.y - 0.4} width={0.8} height={0.8} rx={0.18} className="receiver" />
            <text x={r.x} y={r.y - 0.75} className="receiver-label">
              {r.name}
            </text>
          </g>
        ))}
        {markers.map((marker) => (
          <MarkerView key={marker.id} marker={marker} />
        ))}
      </svg>
    </div>
  );
}

function DefaultScene() {
  return (
    <>
      {DEFAULT_SCENE.furniture.map((f, i) => (
        <rect key={`f${i}`} x={f.x} y={f.y} width={f.w} height={f.h} rx={0.15} className="furniture" />
      ))}
      {DEFAULT_SCENE.walls.map((w, i) => (
        <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className="wall" />
      ))}
      {DEFAULT_SCENE.rooms.map((r, i) => (
        <text key={`r${i}`} x={r.x + r.w / 2} y={r.y + 1.7} className="room-label">
          {r.name}
        </text>
      ))}
    </>
  );
}

function MarkerView({ marker }: { marker: Marker }) {
  const color = colorFor(marker.id);
  const dy = ((hashId(marker.id) % 5) - 2) * 1.9;
  const width = marker.label.length * 0.52 + 0.7;
  const lx = marker.x + 0.7;
  const ly = marker.y - 1.9 + dy;
  return (
    <g>
      <Footprints id={marker.id} trail={marker.trail} color={color} />
      <line x1={marker.x} y1={marker.y} x2={lx + 0.2} y2={ly + 0.65} stroke={color} strokeWidth={0.05} opacity={0.5} />
      <rect
        x={lx}
        y={ly}
        width={width}
        height={1.3}
        rx={0.35}
        fill="#0d1117"
        opacity={0.85}
        stroke={color}
        strokeWidth={0.07}
      />
      <text x={lx + 0.35} y={ly + 0.9} className="entity-label">
        {marker.label}
      </text>
    </g>
  );
}

function Footprints({ id, trail, color }: { id: string; trail: readonly TrailPoint[]; color: string }) {
  const last = trail.length - 1;
  return (
    <>
      {footsteps(trail).map(({ x, y, heading }, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const cx = x + Math.cos(heading + Math.PI / 2) * 0.22 * side;
        const cy = y + Math.sin(heading + Math.PI / 2) * 0.22 * side;
        const head = i === last;
        const opacity = last === 0 ? 0.95 : 0.14 + 0.81 * (i / last);
        return (
          <g key={`${id}-${i}`}>
            {head && <circle cx={x} cy={y} r={0.55} fill={color} opacity={0.13} />}
            <g transform={`translate(${cx} ${cy}) rotate(${(heading * 180) / Math.PI})`} fill={color} opacity={opacity}>
              <ellipse cx={0.15} cy={0} rx={head ? 0.3 : 0.24} ry={head ? 0.16 : 0.13} />
              <ellipse cx={-0.2} cy={0} rx={head ? 0.13 : 0.11} ry={head ? 0.11 : 0.09} />
            </g>
          </g>
        );
      })}
    </>
  );
}

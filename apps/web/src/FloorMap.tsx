import { JSX, MouseEvent } from 'react';
import { Entity, PositionUpdate, Receiver } from '@marauder/shared';

interface Props {
  width: number;
  height: number;
  imageUrl?: string | null;
  receivers: Receiver[];
  entities: Record<string, Entity>;
  positions: Record<string, PositionUpdate>;
  onMapClick?: (x: number, y: number) => void;
}

const PAD = 2;

export function FloorMap({ width, height, imageUrl, receivers, entities, positions, onMapClick }: Props) {
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
        {imageUrl && (
          <image href={imageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="none" opacity={0.55} />
        )}
        {gridLines(width, height)}
        {receivers.map((r) => (
          <g key={r.id}>
            <rect x={r.x - 0.5} y={r.y - 0.5} width={1} height={1} className="receiver" />
            <text x={r.x} y={r.y - 0.9} className="receiver-label">
              {r.name}
            </text>
          </g>
        ))}
        {posList.map((p) => {
          const entity = entities[p.entityId];
          const tagged = (entity?.status ?? p.status) === 'tagged';
          const label = entity?.name ?? p.name ?? 'Unknown';
          return (
            <g key={p.entityId} className={tagged ? 'entity tagged' : 'entity unknown'}>
              <circle cx={p.x} cy={p.y} r={0.7} className="dot" />
              <text x={p.x + 1} y={p.y + 0.4} className="entity-label">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
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

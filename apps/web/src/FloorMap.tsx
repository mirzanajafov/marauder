import { JSX } from 'react';
import { Entity, FLOOR, PositionUpdate, Receiver } from '@marauder/shared';

interface Props {
  receivers: Receiver[];
  entities: Record<string, Entity>;
  positions: Record<string, PositionUpdate>;
}

const PAD = 2;

export function FloorMap({ receivers, entities, positions }: Props) {
  const posList = Object.values(positions);
  return (
    <div className="map">
      <svg
        viewBox={`${-PAD} ${-PAD} ${FLOOR.width + PAD * 2} ${FLOOR.height + PAD * 2}`}
        className="floor"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={FLOOR.width} height={FLOOR.height} className="floor-bg" />
        {gridLines()}
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

function gridLines(): JSX.Element[] {
  const lines: JSX.Element[] = [];
  for (let x = 0; x <= FLOOR.width; x += 5) {
    lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={FLOOR.height} className="grid" />);
  }
  for (let y = 0; y <= FLOOR.height; y += 5) {
    lines.push(<line key={`hy${y}`} x1={0} y1={y} x2={FLOOR.width} y2={y} className="grid" />);
  }
  return lines;
}

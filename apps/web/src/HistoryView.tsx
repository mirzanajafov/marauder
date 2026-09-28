import { useEffect, useMemo, useState } from 'react';
import { EntityStatus, FloorPlan, HistoryPoint, HistorySummary, PositionUpdate, Receiver } from '@marauder/shared';
import { fetchHistory, fetchHistorySummary } from './api';
import { FloorMap } from './FloorMap';

const BUCKET_MS = 500;
const SPEEDS = [0.5, 1, 2, 4];

interface Frame {
  time: number;
  positions: Record<string, PositionUpdate>;
}

interface Props {
  receivers: Receiver[];
  floor: FloorPlan;
}

export function HistoryView({ receivers, floor }: Props) {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchHistorySummary()
      .then(async (s) => {
        if (!active) {
          return;
        }
        setSummary(s);
        if (s.from && s.to && s.count > 0) {
          const pts = await fetchHistory(s.from, s.to, BUCKET_MS);
          if (active) {
            setPoints(pts);
            setIdx(0);
          }
        } else {
          setPoints([]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const frames = useMemo<Frame[]>(() => {
    const buckets = new Map<number, HistoryPoint[]>();
    for (const p of points) {
      const arr = buckets.get(p.time) ?? [];
      arr.push(p);
      buckets.set(p.time, arr);
    }
    const times = [...buckets.keys()].sort((a, b) => a - b);
    const running: Record<string, PositionUpdate> = {};
    const out: Frame[] = [];
    for (const t of times) {
      for (const p of buckets.get(t) ?? []) {
        running[p.entityId] = {
          entityId: p.entityId,
          x: p.x,
          y: p.y,
          accuracy: p.accuracy,
          ts: t,
          name: p.name,
          status: p.status as EntityStatus,
          kind: null,
        };
      }
      out.push({ time: t, positions: { ...running } });
    }
    return out;
  }, [points]);

  useEffect(() => {
    if (!playing || frames.length === 0) {
      return;
    }
    const interval = setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, BUCKET_MS / speed);
    return () => clearInterval(interval);
  }, [playing, speed, frames.length]);

  if (loading) {
    return (
      <div className="map">
        <p className="centered muted">loading history…</p>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="map">
        <p className="centered muted">no history yet — run the simulator to record some movement</p>
      </div>
    );
  }

  const current = frames[Math.min(idx, frames.length - 1)];
  const clock = new Date(current.time).toLocaleTimeString();
  const total = summary?.count ?? 0;

  return (
    <div className="history">
      <FloorMap
        width={floor.width}
        height={floor.height}
        imageUrl={floor.imageUrl}
        receivers={receivers}
        entities={{}}
        positions={current.positions}
      />
      <div className="controls">
        <button className="play" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'pause' : 'play'}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={Math.min(idx, frames.length - 1)}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
        />
        <span className="clock">{clock}</span>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? 'active' : ''} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
        </div>
        <span className="muted count">{total} samples</span>
      </div>
    </div>
  );
}

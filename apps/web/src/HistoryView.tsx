import { useEffect, useMemo, useState } from 'react';
import {
  EntityStatus,
  FloorPlan,
  HistoryPoint,
  PositionUpdate,
  Receiver,
  Wall,
} from '@marauder/shared';
import { fetchHistory, fetchHistorySummary } from './api';
import { FloorMap } from './FloorMap';

const FRAMES = 1200;
const MIN_BUCKET_MS = 500;
const WINDOWS = [
  { label: '10 min', ms: 10 * 60_000 },
  { label: '1 h', ms: 60 * 60_000 },
];
const SPEEDS = [0.5, 1, 2, 4];
const TRAIL_LEN = 6;

interface Frame {
  time: number;
  positions: Record<string, PositionUpdate>;
}

interface Props {
  receivers: Receiver[];
  floor: FloorPlan;
  walls?: Wall[];
}

export function HistoryView({ receivers, floor, walls }: Props) {
  const [windowMs, setWindowMs] = useState(WINDOWS[0].ms);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const bucketMs = Math.max(MIN_BUCKET_MS, Math.round(windowMs / FRAMES));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPlaying(false);
    fetchHistorySummary()
      .then(async (s) => {
        if (!active) {
          return;
        }
        if (s.from && s.to) {
          const to = new Date(s.to).getTime();
          const from = Math.max(new Date(s.from).getTime(), to - windowMs);
          const pts = await fetchHistory(new Date(from).toISOString(), s.to, bucketMs);
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
  }, [windowMs, bucketMs]);

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

  const clamped = frames.length > 0 ? Math.min(idx, frames.length - 1) : 0;

  const trails = useMemo<Record<string, { x: number; y: number }[]>>(() => {
    const out: Record<string, { x: number; y: number }[]> = {};
    const start = Math.max(0, clamped - TRAIL_LEN + 1);
    for (let j = start; j <= clamped && j < frames.length; j++) {
      const fp = frames[j].positions;
      for (const id of Object.keys(fp)) {
        (out[id] ??= []).push({ x: fp[id].x, y: fp[id].y });
      }
    }
    return out;
  }, [frames, clamped]);

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
    }, bucketMs / speed);
    return () => clearInterval(interval);
  }, [playing, speed, frames.length, bucketMs]);

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

  const current = frames[clamped];
  const clock = new Date(current.time).toLocaleTimeString();

  return (
    <div className="history">
      <FloorMap
        width={floor.width}
        height={floor.height}
        imageUrl={floor.imageUrl}
        walls={walls}
        receivers={receivers}
        entities={{}}
        positions={current.positions}
        trails={trails}
      />
      <div className="controls">
        <button className="play" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'pause' : 'play'}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={clamped}
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
        <div className="speeds">
          {WINDOWS.map((w) => (
            <button key={w.ms} className={w.ms === windowMs ? 'active' : ''} onClick={() => setWindowMs(w.ms)}>
              {w.label}
            </button>
          ))}
        </div>
        <span className="muted count">{points.length} points</span>
      </div>
    </div>
  );
}

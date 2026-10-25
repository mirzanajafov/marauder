import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FloorPlan, HistoryPoint, Receiver } from '@marauder/shared';
import { describeError, fetchHistory, fetchHistorySummary } from './api';
import { FloorMap } from './FloorMap';
import { Frame, WINDOWS, bucketFor, buildFrames, trailsAt } from './history';
import { Marker } from './marker';

const SPEEDS = [0.5, 1, 2, 4] as const;

interface Props {
  plan: FloorPlan;
  receivers: readonly Receiver[];
}

type Loaded = { windowMs: number; load: number; points: HistoryPoint[] } | { windowMs: number; error: string };

async function loadWindow(windowMs: number): Promise<HistoryPoint[]> {
  const { from, to } = await fetchHistorySummary();
  if (!from || !to) {
    return [];
  }
  const end = new Date(to).getTime();
  const start = Math.max(new Date(from).getTime(), end - windowMs);
  return fetchHistory(new Date(start).toISOString(), to, bucketFor(windowMs));
}

export function HistoryView({ plan, receivers }: Props) {
  const [windowMs, setWindowMs] = useState<number>(WINDOWS[0].ms);
  const [speed, setSpeed] = useState<number>(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loads = useRef(0);

  useEffect(() => {
    let current = true;
    loadWindow(windowMs).then(
      (points) => {
        if (current) {
          loads.current += 1;
          setLoaded({ windowMs, load: loads.current, points });
        }
      },
      (failure: unknown) => {
        if (current) {
          setLoaded({ windowMs, error: describeError(failure) });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [windowMs, attempt]);

  const windows = (
    <div className="speeds">
      {WINDOWS.map((w) => (
        <button key={w.ms} className={w.ms === windowMs ? 'active' : ''} onClick={() => setWindowMs(w.ms)}>
          {w.label}
        </button>
      ))}
    </div>
  );

  if (loaded?.windowMs !== windowMs) {
    return <Message text="loading history…">{windows}</Message>;
  }
  if ('error' in loaded) {
    return (
      <Message text={`could not load the history: ${loaded.error}`}>
        {windows}
        <button
          onClick={() => {
            setLoaded(null);
            setAttempt((count) => count + 1);
          }}
        >
          retry
        </button>
      </Message>
    );
  }
  if (loaded.points.length === 0) {
    return <Message text="no history yet: run the simulator to record some movement">{windows}</Message>;
  }
  return (
    <Playback
      key={loaded.load}
      plan={plan}
      receivers={receivers}
      points={loaded.points}
      stepMs={bucketFor(windowMs) / speed}
    >
      <div className="speeds">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'active' : ''} onClick={() => setSpeed(s)}>
            {s}x
          </button>
        ))}
      </div>
      {windows}
    </Playback>
  );
}

function Message({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="history">
      <div className="map">
        <p className="centered muted">{text}</p>
      </div>
      <div className="controls">{children}</div>
    </div>
  );
}

interface PlaybackProps extends Props {
  points: HistoryPoint[];
  stepMs: number;
  children: ReactNode;
}

function Playback({ plan, receivers, points, stepMs, children }: PlaybackProps) {
  const frames = useMemo(() => buildFrames(points), [points]);
  const last = frames.length - 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const running = playing && index < last;

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, last)), stepMs);
    return () => clearInterval(timer);
  }, [running, stepMs, last]);

  const frame: Frame | undefined = frames[index];
  const markers = useMemo<Marker[]>(() => {
    const trails = trailsAt(frames, index);
    return Object.values(frame?.points ?? {}).map((p) => ({
      id: p.entityId,
      x: p.x,
      y: p.y,
      label: p.name ?? 'Unknown',
      trail: trails[p.entityId] ?? [],
    }));
  }, [frames, frame, index]);

  return (
    <div className="history">
      <FloorMap plan={plan} receivers={receivers} markers={markers} />
      <div className="controls">
        <button
          className="play"
          onClick={() => {
            if (running) {
              setPlaying(false);
              return;
            }
            if (index >= last) {
              setIndex(0);
            }
            setPlaying(true);
          }}
        >
          {running ? 'pause' : 'play'}
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          aria-label="replay position"
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
        />
        <span className="clock">{frame ? new Date(frame.time).toLocaleTimeString() : ''}</span>
        {children}
        <span className="muted count">{points.length} points</span>
      </div>
    </div>
  );
}

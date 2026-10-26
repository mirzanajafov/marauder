import { ReactNode, useEffect, useMemo, useState } from 'react';
import { FloorPlan, HistoryPoint, Receiver } from '@marauder/shared';
import { errorMessage, fetchHistory, fetchHistorySummary } from './api';
import { FloorMap, Marker } from './FloorMap';
import { Frame, WINDOWS, bucketFor, buildFrames } from './history';

const SPEEDS = [0.5, 1, 2, 4] as const;

interface Props {
  plan: FloorPlan;
  receivers: readonly Receiver[];
}

type Loaded = { points: HistoryPoint[] } | { error: string };

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
  const [request, setRequest] = useState<{ windowMs: number }>({ windowMs: WINDOWS[0].ms });
  const [speed, setSpeed] = useState<number>(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const { windowMs } = request;

  useEffect(() => {
    let current = true;
    loadWindow(request.windowMs).then(
      (points) => {
        if (current) {
          setLoaded({ points });
        }
      },
      (failure: unknown) => {
        if (current) {
          setLoaded({ error: errorMessage(failure) });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [request]);

  const load = (ms: number): void => {
    setLoaded(null);
    setRequest({ windowMs: ms });
  };

  const windows = (
    <div className="speeds">
      {WINDOWS.map((w) => (
        <button key={w.ms} className={w.ms === windowMs ? 'active' : ''} onClick={() => load(w.ms)}>
          {w.label}
        </button>
      ))}
    </div>
  );

  if (loaded === null) {
    return <Message text="loading history…">{windows}</Message>;
  }
  if ('error' in loaded) {
    return (
      <Message text={`could not load the history: ${loaded.error}`}>
        {windows}
        <button className="retry" onClick={() => load(windowMs)}>
          retry
        </button>
      </Message>
    );
  }
  if (loaded.points.length === 0) {
    return <Message text="no history yet: run the simulator to record some movement">{windows}</Message>;
  }
  return (
    <Playback plan={plan} receivers={receivers} points={loaded.points} stepMs={bucketFor(windowMs) / speed}>
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
  const markers = useMemo<Marker[]>(
    () =>
      Object.values(frame?.points ?? {}).map((p) => ({
        id: p.entityId,
        x: p.x,
        y: p.y,
        label: p.name ?? 'Unknown',
        trail: frame?.trails[p.entityId] ?? [],
      })),
    [frame],
  );

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

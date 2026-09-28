import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SCENE,
  Entity,
  EntityDiscoveredEvent,
  EntityUpdatedEvent,
  FloorPlan,
  PositionUpdate,
  PositionsBatchEvent,
  Receiver,
  WsEvents,
} from '@marauder/shared';
import { fetchEntities, fetchFloorPlan, fetchReceivers, login, setAuthToken, tagEntity } from './api';
import { clearToken, loadToken, saveToken } from './token';
import { createSocket } from './socket';
import { FloorMap } from './FloorMap';
import { AdminPanel } from './AdminPanel';
import { HistoryView } from './HistoryView';
import { ConfigPanel } from './ConfigPanel';

type Mode = 'live' | 'history' | 'config';
type Trail = { x: number; y: number };

const DEFAULT_FLOOR: FloorPlan = { imageUrl: null, width: DEFAULT_SCENE.width, height: DEFAULT_SCENE.height, floor: 0 };
const TRAIL_LEN = 10;
const TRAIL_MIN_MOVE = 0.45;

export function App() {
  const [mode, setMode] = useState<Mode>('live');
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [floor, setFloor] = useState<FloorPlan>(DEFAULT_FLOOR);
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [positions, setPositions] = useState<Record<string, PositionUpdate>>({});
  const [trails, setTrails] = useState<Record<string, Trail[]>>({});
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const reloadReceivers = (): void => {
    fetchReceivers().then(setReceivers).catch(() => undefined);
  };

  useEffect(() => {
    const stored = loadToken();
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
    }

    reloadReceivers();
    fetchFloorPlan().then(setFloor).catch(() => undefined);
    fetchEntities()
      .then((list) => setEntities(Object.fromEntries(list.map((e) => [e.id, e]))))
      .catch(() => undefined);

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(WsEvents.EntityDiscovered, (p: EntityDiscoveredEvent) => {
      setEntities((prev) => ({ ...prev, [p.entity.id]: p.entity }));
    });
    socket.on(WsEvents.EntityUpdated, (p: EntityUpdatedEvent) => {
      setEntities((prev) => ({ ...prev, [p.entity.id]: p.entity }));
    });
    socket.on(WsEvents.PositionsBatch, (p: PositionsBatchEvent) => {
      setPositions((prev) => {
        const next = { ...prev };
        for (const pos of p.positions) {
          next[pos.entityId] = pos;
        }
        return next;
      });
      setTrails((prev) => {
        const next = { ...prev };
        for (const pos of p.positions) {
          const arr = next[pos.entityId] ? [...next[pos.entityId]] : [];
          const head = arr[arr.length - 1];
          if (!head || Math.hypot(head.x - pos.x, head.y - pos.y) > TRAIL_MIN_MOVE) {
            arr.push({ x: pos.x, y: pos.y });
            while (arr.length > TRAIL_LEN) {
              arr.shift();
            }
          }
          next[pos.entityId] = arr.length > 0 ? arr : [{ x: pos.x, y: pos.y }];
        }
        return next;
      });
    });

    return () => {
      socket.close();
    };
  }, []);

  const onTag = async (id: string, name: string): Promise<void> => {
    const updated = await tagEntity(id, { name });
    setEntities((prev) => ({ ...prev, [updated.id]: updated }));
  };

  const doLogin = async (): Promise<void> => {
    try {
      const next = await login(password);
      setToken(next);
      setAuthToken(next);
      saveToken(next);
      setPassword('');
      setLoginError(false);
    } catch {
      setLoginError(true);
    }
  };

  const logout = (): void => {
    setToken(null);
    setAuthToken(null);
    clearToken();
  };

  const authed = token !== null;
  const entityList = useMemo(() => Object.values(entities), [entities]);
  const walls = floor.imageUrl ? undefined : DEFAULT_SCENE.walls;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Marauder</h1>
        <div className="modes">
          <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>
            live
          </button>
          <button className={mode === 'history' ? 'active' : ''} onClick={() => setMode('history')}>
            history
          </button>
          <button className={mode === 'config' ? 'active' : ''} onClick={() => setMode('config')}>
            config
          </button>
        </div>
        {mode === 'live' && (
          <span className={connected ? 'status on' : 'status off'}>{connected ? 'live' : 'offline'}</span>
        )}
        <div className="auth">
          {authed ? (
            <>
              <span className="admin-badge">admin</span>
              <button onClick={logout}>logout</button>
            </>
          ) : (
            <>
              <input
                type="password"
                className={loginError ? 'error' : ''}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void doLogin();
                  }
                }}
                placeholder="admin password"
              />
              <button onClick={() => void doLogin()} disabled={password.trim() === ''}>
                login
              </button>
            </>
          )}
        </div>
      </header>
      <main className="layout">
        {mode === 'live' && (
          <>
            <FloorMap
              width={floor.width}
              height={floor.height}
              imageUrl={floor.imageUrl}
              walls={walls}
              receivers={receivers}
              entities={entities}
              positions={positions}
              trails={trails}
            />
            <AdminPanel entities={entityList} onTag={onTag} authed={authed} />
          </>
        )}
        {mode === 'history' && <HistoryView receivers={receivers} floor={floor} walls={walls} />}
        {mode === 'config' && (
          <ConfigPanel
            receivers={receivers}
            floor={floor}
            walls={walls}
            authed={authed}
            onReceiversChange={reloadReceivers}
            onFloorChange={setFloor}
          />
        )}
      </main>
    </div>
  );
}

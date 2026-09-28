import { useEffect, useMemo, useState } from 'react';
import {
  Entity,
  EntityDiscoveredEvent,
  EntityUpdatedEvent,
  FloorPlan,
  PositionUpdate,
  PositionsBatchEvent,
  Receiver,
  WsEvents,
} from '@marauder/shared';
import { fetchEntities, fetchFloorPlan, fetchReceivers, tagEntity } from './api';
import { createSocket } from './socket';
import { FloorMap } from './FloorMap';
import { AdminPanel } from './AdminPanel';
import { HistoryView } from './HistoryView';
import { ConfigPanel } from './ConfigPanel';

type Mode = 'live' | 'history' | 'config';

const DEFAULT_FLOOR: FloorPlan = { imageUrl: null, width: 40, height: 25, floor: 0 };

export function App() {
  const [mode, setMode] = useState<Mode>('live');
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [floor, setFloor] = useState<FloorPlan>(DEFAULT_FLOOR);
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [positions, setPositions] = useState<Record<string, PositionUpdate>>({});
  const [connected, setConnected] = useState(false);

  const reloadReceivers = (): void => {
    fetchReceivers().then(setReceivers).catch(() => undefined);
  };

  useEffect(() => {
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
    });

    return () => {
      socket.close();
    };
  }, []);

  const onTag = async (id: string, name: string): Promise<void> => {
    const updated = await tagEntity(id, { name });
    setEntities((prev) => ({ ...prev, [updated.id]: updated }));
  };

  const entityList = useMemo(() => Object.values(entities), [entities]);

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
      </header>
      <main className="layout">
        {mode === 'live' && (
          <>
            <FloorMap
              width={floor.width}
              height={floor.height}
              imageUrl={floor.imageUrl}
              receivers={receivers}
              entities={entities}
              positions={positions}
            />
            <AdminPanel entities={entityList} onTag={onTag} />
          </>
        )}
        {mode === 'history' && <HistoryView receivers={receivers} floor={floor} />}
        {mode === 'config' && (
          <ConfigPanel
            receivers={receivers}
            floor={floor}
            onReceiversChange={reloadReceivers}
            onFloorChange={setFloor}
          />
        )}
      </main>
    </div>
  );
}

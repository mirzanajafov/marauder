import { useEffect, useMemo, useState } from 'react';
import {
  Entity,
  EntityDiscoveredEvent,
  EntityUpdatedEvent,
  PositionUpdate,
  PositionsBatchEvent,
  Receiver,
  WsEvents,
} from '@marauder/shared';
import { fetchEntities, fetchReceivers, tagEntity } from './api';
import { createSocket } from './socket';
import { FloorMap } from './FloorMap';
import { AdminPanel } from './AdminPanel';

export function App() {
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [positions, setPositions] = useState<Record<string, PositionUpdate>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchReceivers().then(setReceivers).catch(() => undefined);
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
        <span className={connected ? 'status on' : 'status off'}>{connected ? 'live' : 'offline'}</span>
      </header>
      <main className="layout">
        <FloorMap receivers={receivers} entities={entities} positions={positions} />
        <AdminPanel entities={entityList} onTag={onTag} />
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Entity,
  EntityDiscoveredEvent,
  EntityUpdatedEvent,
  PositionUpdate,
  PositionsBatchEvent,
  WsEvents,
} from '@marauder/shared';
import { describeError, fetchEntities } from './api';
import { WS_URL } from './config';
import { Marker } from './marker';
import { TrailPoint, extendTrail } from './trails';

interface Track {
  position: PositionUpdate;
  trail: TrailPoint[];
}

export function useLiveTracking() {
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rememberEntity = useCallback((entity: Entity): void => {
    setEntities((known) => ({ ...known, [entity.id]: entity }));
  }, []);

  useEffect(() => {
    let heardSinceSnapshot = new Set<string>();
    const announced = ({ entity }: EntityDiscoveredEvent | EntityUpdatedEvent): void => {
      heardSinceSnapshot.add(entity.id);
      rememberEntity(entity);
    };
    const move = ({ positions }: PositionsBatchEvent): void => {
      setTracks((previous) => {
        const next = { ...previous };
        for (const position of positions) {
          next[position.entityId] = {
            position,
            trail: extendTrail(previous[position.entityId]?.trail ?? [], position),
          };
        }
        return next;
      });
    };
    const loadSnapshot = (): void => {
      const heard = new Set<string>();
      heardSinceSnapshot = heard;
      fetchEntities().then(
        (list) => {
          setEntities((known) => {
            const next = Object.fromEntries(list.map((entity) => [entity.id, entity]));
            for (const id of heard) {
              const newer = known[id];
              if (newer) {
                next[id] = newer;
              }
            }
            return next;
          });
          setError(null);
        },
        (failure: unknown) => setError(`could not load the tags: ${describeError(failure)}`),
      );
    };

    loadSnapshot();
    let connectedBefore = false;
    const socket = io(WS_URL, { transports: ['websocket'] });
    socket.on('connect', () => {
      setConnected(true);
      if (connectedBefore) {
        loadSnapshot();
      }
      connectedBefore = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(WsEvents.EntityDiscovered, announced);
    socket.on(WsEvents.EntityUpdated, announced);
    socket.on(WsEvents.PositionsBatch, move);
    return () => {
      socket.close();
    };
  }, [rememberEntity]);

  const markers = useMemo<Marker[]>(
    () =>
      Object.values(tracks).map(({ position, trail }) => ({
        id: position.entityId,
        x: position.x,
        y: position.y,
        label: entities[position.entityId]?.name ?? position.name ?? 'Unknown',
        trail,
      })),
    [tracks, entities],
  );

  const entityList = useMemo(() => Object.values(entities), [entities]);

  return { entities: entityList, markers, connected, error, rememberEntity };
}

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
import { mergeSnapshot } from './roster';
import { TrailPoint, extendTrail } from './trails';

interface Track {
  position: PositionUpdate;
  trail: readonly TrailPoint[];
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
    let latestSnapshot = 0;
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
      latestSnapshot += 1;
      const snapshot = latestSnapshot;
      const heard = new Set<string>();
      heardSinceSnapshot = heard;
      fetchEntities().then(
        (list) => {
          if (snapshot === latestSnapshot) {
            setEntities((known) => mergeSnapshot(list, known, heard));
            setError(null);
          }
        },
        (failure: unknown) => {
          if (snapshot === latestSnapshot) {
            setError(`could not load the tags: ${describeError(failure)}`);
          }
        },
      );
    };

    const socket = io(WS_URL, { transports: ['websocket'] });
    socket.on('connect', () => {
      setConnected(true);
      loadSnapshot();
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

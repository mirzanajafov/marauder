import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Entity, EntityDiscoveredEvent, EntityUpdatedEvent, PositionsBatchEvent, WsEvents } from '@marauder/shared';
import { errorMessage, fetchEntities } from './api';
import { WS_URL } from './config';
import { Marker } from './FloorMap';
import { mergeSnapshot } from './roster';
import { Tracks, applyPositions, dropQuietTracks } from './tracks';
import { LoadFailure } from './useLoaded';

const PRUNE_MS = 1_000;

export function useLiveTracking() {
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [tracks, setTracks] = useState<Tracks>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSnapshot = useRef(0);
  const heardSinceSnapshot = useRef(new Set<string>());

  const rememberEntity = useCallback((entity: Entity): void => {
    setEntities((known) => ({ ...known, [entity.id]: entity }));
  }, []);

  const loadSnapshot = useCallback((): void => {
    latestSnapshot.current += 1;
    const snapshot = latestSnapshot.current;
    const heard = new Set<string>();
    heardSinceSnapshot.current = heard;
    fetchEntities().then(
      (list) => {
        if (snapshot === latestSnapshot.current) {
          setEntities((known) => mergeSnapshot(list, known, heard));
          setError(null);
        }
      },
      (failure: unknown) => {
        if (snapshot === latestSnapshot.current) {
          setError(`could not load the tags: ${errorMessage(failure)}`);
        }
      },
    );
  }, []);

  useEffect(() => {
    const announced = ({ entity }: EntityDiscoveredEvent | EntityUpdatedEvent): void => {
      heardSinceSnapshot.current.add(entity.id);
      rememberEntity(entity);
    };
    const move = ({ positions }: PositionsBatchEvent): void => {
      setTracks((previous) => applyPositions(previous, positions, performance.now()));
    };

    loadSnapshot();
    const socket = io(WS_URL, { transports: ['websocket'] });
    socket.on('connect', () => {
      setConnected(true);
      loadSnapshot();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(WsEvents.EntityDiscovered, announced);
    socket.on(WsEvents.EntityUpdated, announced);
    socket.on(WsEvents.PositionsBatch, move);
    const pruning = setInterval(() => setTracks((current) => dropQuietTracks(current, performance.now())), PRUNE_MS);
    return () => {
      clearInterval(pruning);
      socket.close();
    };
  }, [loadSnapshot, rememberEntity]);

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
  const failure: LoadFailure | null = error === null ? null : { message: error, retry: loadSnapshot };

  return { entities: entityList, markers, connected, failure, rememberEntity };
}

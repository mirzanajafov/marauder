import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Entity, EntityDiscoveredEvent, EntityUpdatedEvent, PositionsBatchEvent, WsEvents } from '@marauder/shared';
import { fetchEntities } from './api';
import { WS_URL } from './config';
import { Snapshot, mergeSnapshot } from './roster';
import { Tracks, applyPositions, dropQuietTracks, toMarkers } from './tracks';
import { useLoaded } from './useLoaded';

const PRUNE_MS = 1_000;

export function useLiveTracking() {
  const [tracks, setTracks] = useState<Tracks>({});
  const [connected, setConnected] = useState(false);
  const heardDuringSnapshot = useRef<Set<string> | null>(null);

  const loadSnapshot = useCallback(async (): Promise<Snapshot> => {
    const heardDuring = new Set<string>();
    heardDuringSnapshot.current = heardDuring;
    return { entities: await fetchEntities(), heardDuring };
  }, []);
  const {
    value: entities,
    setValue: setEntities,
    reload: reloadRoster,
    failure,
  } = useLoaded<Record<string, Entity>, Snapshot>(loadSnapshot, mergeSnapshot, {}, 'tags');

  const rememberEntity = useCallback(
    (entity: Entity): void => {
      heardDuringSnapshot.current?.add(entity.id);
      setEntities((known) => ({ ...known, [entity.id]: entity }));
    },
    [setEntities],
  );

  useEffect(() => {
    const announced = ({ entity }: EntityDiscoveredEvent | EntityUpdatedEvent): void => rememberEntity(entity);
    const move = ({ positions }: PositionsBatchEvent): void => {
      setTracks((previous) => applyPositions(previous, positions, performance.now()));
    };

    const socket = io(WS_URL, { transports: ['websocket'] });
    socket.on('connect', () => {
      setConnected(true);
      reloadRoster();
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
  }, [reloadRoster, rememberEntity]);

  const markers = useMemo(() => toMarkers(tracks, entities), [tracks, entities]);

  const entityList = useMemo(() => Object.values(entities), [entities]);

  return { entities: entityList, markers, connected, failure, rememberEntity };
}

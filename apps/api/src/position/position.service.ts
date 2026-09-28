import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DEFAULT_PATH_LOSS_EXPONENT,
  Entity,
  PositionUpdate,
  RawSignal,
  Receiver,
} from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { Anchor, rssiToDistance, trilaterate } from './trilateration';

interface Reading {
  distance: number;
  weight: number;
  ts: number;
}

interface Track {
  readings: Map<string, Reading>;
  ema: { x: number; y: number } | null;
  lastReadingTs: number;
  name: string | null;
  kind: string | null;
  status: Entity['status'];
}

const STALE_READING_MS = 3_000;
const DROP_TRACK_MS = 12_000;
const EMA_ALPHA = 0.22;

@Injectable()
export class PositionService implements OnModuleInit, OnModuleDestroy {
  private readonly tracks = new Map<string, Track>();
  private receivers = new Map<string, Receiver>();
  private readonly pathLoss =
    Number(process.env.PATH_LOSS_EXPONENT ?? DEFAULT_PATH_LOSS_EXPONENT) || DEFAULT_PATH_LOSS_EXPONENT;
  private flushTimer: NodeJS.Timeout | null = null;
  private receiverTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly receiversService: ReceiversService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshReceivers();
    const flushMs = Number(process.env.POSITION_FLUSH_MS ?? 150) || 150;
    this.flushTimer = setInterval(() => void this.flush(), flushMs);
    this.receiverTimer = setInterval(() => void this.refreshReceivers(), 30_000);
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.receiverTimer) {
      clearInterval(this.receiverTimer);
    }
  }

  record(entity: Entity, signal: RawSignal): void {
    let track = this.tracks.get(entity.id);
    if (!track) {
      track = {
        readings: new Map(),
        ema: null,
        lastReadingTs: signal.ts,
        name: entity.name,
        kind: entity.kind,
        status: entity.status,
      };
      this.tracks.set(entity.id, track);
    }
    track.name = entity.name;
    track.kind = entity.kind;
    track.status = entity.status;
    track.lastReadingTs = Math.max(track.lastReadingTs, signal.ts);
    const distance = rssiToDistance(signal.rssi, signal.txPower, this.pathLoss);
    track.readings.set(signal.receiverId, {
      distance,
      weight: 1 / (distance * distance + 1),
      ts: signal.ts,
    });
  }

  private async refreshReceivers(): Promise<void> {
    const list = await this.receiversService.list();
    const next = new Map<string, Receiver>();
    for (const r of list) {
      next.set(r.id, r);
    }
    this.receivers = next;
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    const updates: PositionUpdate[] = [];

    for (const [entityId, track] of this.tracks) {
      if (now - track.lastReadingTs > DROP_TRACK_MS) {
        this.tracks.delete(entityId);
        continue;
      }

      const anchors: Anchor[] = [];
      for (const [receiverId, reading] of track.readings) {
        if (now - reading.ts > STALE_READING_MS) {
          track.readings.delete(receiverId);
          continue;
        }
        const receiver = this.receivers.get(receiverId);
        if (!receiver) {
          continue;
        }
        anchors.push({ x: receiver.x, y: receiver.y, distance: reading.distance, weight: reading.weight });
      }

      if (anchors.length === 0) {
        continue;
      }

      const estimate = trilaterate(anchors);
      const ema = track.ema
        ? {
            x: EMA_ALPHA * estimate.x + (1 - EMA_ALPHA) * track.ema.x,
            y: EMA_ALPHA * estimate.y + (1 - EMA_ALPHA) * track.ema.y,
          }
        : { x: estimate.x, y: estimate.y };
      track.ema = ema;

      updates.push({
        entityId,
        x: ema.x,
        y: ema.y,
        accuracy: estimate.accuracy,
        ts: now,
        name: track.name,
        status: track.status,
        kind: track.kind,
      });
    }

    if (updates.length === 0) {
      return;
    }

    this.events.emit('positions.batch', { positions: updates });
    await this.persist(updates, now);
  }

  private async persist(updates: PositionUpdate[], now: number): Promise<void> {
    try {
      await this.prisma.position.createMany({
        data: updates.map((u) => ({
          time: new Date(now),
          entityId: u.entityId,
          x: u.x,
          y: u.y,
          accuracy: Number.isFinite(u.accuracy) ? u.accuracy : 0,
        })),
        skipDuplicates: true,
      });
    } catch {
      return;
    }
  }
}

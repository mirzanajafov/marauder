import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEFAULT_PATH_LOSS_EXPONENT, Entity, PositionUpdate, RawSignal, Receiver } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { EMA_ALPHA, Tracker } from './tracker';

@Injectable()
export class PositionService implements OnModuleInit, OnModuleDestroy {
  private readonly tracker = new Tracker({
    pathLossExponent:
      Number(process.env.PATH_LOSS_EXPONENT ?? DEFAULT_PATH_LOSS_EXPONENT) || DEFAULT_PATH_LOSS_EXPONENT,
    alpha: EMA_ALPHA,
  });
  private receivers = new Map<string, Receiver>();
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
    this.tracker.record(entity, signal);
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
    const updates = this.tracker.positions(now, this.receivers);

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

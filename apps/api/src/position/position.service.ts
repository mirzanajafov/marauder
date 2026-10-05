import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEFAULT_PATH_LOSS_EXPONENT, Entity, FLOOR, PositionUpdate, RawSignal, Receiver } from '@marauder/shared';
import { FloorPlanService } from '../floorplan/floorplan.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { POSITION_ALPHA, RSSI_ALPHA, Tracker } from './tracker';
import { Bounds, fitPosition } from './trilateration';

export const WRITE_FAILURE_LOG_MS = 30_000;

@Injectable()
export class PositionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionService.name);
  private failedWrites = 0;
  private lastFailureLog = Number.NEGATIVE_INFINITY;
  private bounds: Bounds = { width: FLOOR.width, height: FLOOR.height };
  private readonly tracker = new Tracker({
    pathLossExponent:
      Number(process.env.PATH_LOSS_EXPONENT ?? DEFAULT_PATH_LOSS_EXPONENT) || DEFAULT_PATH_LOSS_EXPONENT,
    alpha: POSITION_ALPHA,
    rssiAlpha: RSSI_ALPHA,
    solve: (anchors) => fitPosition(anchors, this.bounds),
  });
  private receivers = new Map<string, Receiver>();
  private flushTimer: NodeJS.Timeout | null = null;
  private receiverTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly receiversService: ReceiversService,
    private readonly floorPlanService: FloorPlanService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshLayout();
    const flushMs = Number(process.env.POSITION_FLUSH_MS ?? 150) || 150;
    this.flushTimer = setInterval(() => void this.flush(), flushMs);
    this.receiverTimer = setInterval(() => void this.refreshLayout(), 30_000);
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

  private async refreshLayout(): Promise<void> {
    const [list, plan] = await Promise.all([this.receiversService.list(), this.floorPlanService.get()]);
    const next = new Map<string, Receiver>();
    for (const r of list) {
      next.set(r.id, r);
    }
    this.receivers = next;
    this.bounds = { width: plan.width, height: plan.height };
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
    } catch (error) {
      this.failedWrites += 1;
      if (now - this.lastFailureLog >= WRITE_FAILURE_LOG_MS) {
        this.lastFailureLog = now;
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `could not write ${updates.length} positions to history (${this.failedWrites} failed batches so far): ${reason}`,
        );
      }
    }
  }
}

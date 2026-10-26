import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Entity, FLOOR, PositionUpdate, PositionsBatchEvent, RawSignal, Receiver, WsEvents } from '@marauder/shared';
import { EnvironmentVariables } from '../config/env.validation';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';
import { FloorPlanService } from '../floorplan/floorplan.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiversService } from '../receivers/receivers.service';
import { POSITION_ALPHA, RSSI_ALPHA, Tracker } from './tracker';
import { Bounds, fitPosition } from './trilateration';

export const LAYOUT_REFRESH_MS = 30_000;

@Injectable()
export class PositionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionService.name);
  private readonly failedWrites = new ThrottledLog(this.logger);
  private bounds: Bounds = { width: FLOOR.width, height: FLOOR.height };
  private readonly tracker: Tracker;
  private readonly flushMs: number;
  private receivers = new Map<string, Receiver>();
  private flushTimer?: NodeJS.Timeout;
  private layoutTimer?: NodeJS.Timeout;

  constructor(
    private readonly receiversService: ReceiversService,
    private readonly floorPlanService: FloorPlanService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.flushMs = config.get('POSITION_FLUSH_MS', { infer: true });
    this.tracker = new Tracker({
      pathLossExponent: config.get('PATH_LOSS_EXPONENT', { infer: true }),
      alpha: POSITION_ALPHA,
      rssiAlpha: RSSI_ALPHA,
      solve: (anchors) => fitPosition(anchors, this.bounds),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.refreshLayout();
    this.flushTimer = setInterval(() => void this.flush(), this.flushMs);
    this.layoutTimer = setInterval(() => {
      this.refreshLayout().catch((error: unknown) => {
        this.logger.error(
          `could not refresh receivers and floor plan, keeping the last layout: ${errorMessage(error)}`,
        );
      });
    }, LAYOUT_REFRESH_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.flushTimer);
    clearInterval(this.layoutTimer);
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

    this.events.emit(WsEvents.PositionsBatch, { positions: updates } satisfies PositionsBatchEvent);
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
      this.failedWrites.failure(
        (failures) =>
          `could not write ${updates.length} positions to history (${failures} failed batches so far): ${errorMessage(error)}`,
      );
    }
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  DEFAULT_FLOORPLAN,
  PositionUpdate,
  PositionsBatchEvent,
  ReceivedSignal,
  Receiver,
  WsEvents,
} from '@marauder/shared';
import { EnvironmentVariables } from '../config/env.validation';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';
import { FLOOR_PLAN_CHANGED } from '../floorplan/floorplan.events';
import { FloorPlanService } from '../floorplan/floorplan.service';
import { PrismaService } from '../prisma/prisma.service';
import { RECEIVERS_CHANGED } from '../receivers/receivers.events';
import { ReceiversService } from '../receivers/receivers.service';
import { Bounds, fitPosition } from './position-fit';
import { POSITION_ALPHA, RSSI_ALPHA, Tracker } from './tracker';

export const LAYOUT_RELOAD_MS = 60_000;

@Injectable()
export class PositionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionService.name);
  private readonly failedWrites = new ThrottledLog(this.logger);
  private bounds: Bounds = { width: DEFAULT_FLOORPLAN.width, height: DEFAULT_FLOORPLAN.height };
  private readonly tracker: Tracker;
  private readonly flushMs: number;
  private receivers = new Map<string, Receiver>();
  private layoutReload: Promise<void> = Promise.resolve();
  private flushTimer?: NodeJS.Timeout;
  private reloadTimer?: NodeJS.Timeout;

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
    await this.loadLayout();
    this.flushTimer = setInterval(() => void this.flush(), this.flushMs);
    this.reloadTimer = setInterval(() => void this.reloadLayout(), LAYOUT_RELOAD_MS);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushTimer);
    clearInterval(this.reloadTimer);
    await this.layoutReload;
  }

  record(entityId: string, signal: ReceivedSignal): void {
    this.tracker.record(entityId, signal);
  }

  @OnEvent(RECEIVERS_CHANGED)
  @OnEvent(FLOOR_PLAN_CHANGED)
  reloadLayout(): Promise<void> {
    this.layoutReload = this.layoutReload.then(() =>
      this.loadLayout().catch((error: unknown) => {
        this.logger.error(`could not reload the receivers and floor plan: ${errorMessage(error)}`);
      }),
    );
    return this.layoutReload;
  }

  private async loadLayout(): Promise<void> {
    const [receivers, plan] = await Promise.all([this.receiversService.list(), this.floorPlanService.get()]);
    this.receivers = new Map(receivers.map((receiver) => [receiver.id, receiver]));
    this.bounds = { width: plan.width, height: plan.height };
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    const updates = this.tracker.advance(now, this.receivers);

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
          accuracy: u.accuracy,
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

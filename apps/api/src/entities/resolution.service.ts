import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityDiscoveredEvent, WsEvents } from '@marauder/shared';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';
import { EntityStore } from './entity.store';

export const SEEN_INTERVAL_MS = 10_000;

@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);
  private readonly failedSeenWrites = new ThrottledLog(this.logger);
  private readonly lastSeenWrites = new Map<string, number>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly store: EntityStore,
    private readonly events: EventEmitter2,
  ) {}

  get rememberedEntityCount(): number {
    return this.lastSeenWrites.size;
  }

  async resolve(fingerprint: string): Promise<string> {
    const known = await this.store.findIdByFingerprint(fingerprint);
    if (known) {
      this.recordSeen(known);
      return known;
    }
    const { entity, created } = await this.store.createUnknown(fingerprint);
    this.remember(entity.id, performance.now());
    if (created) {
      this.events.emit(WsEvents.EntityDiscovered, { entity } satisfies EntityDiscoveredEvent);
    }
    return entity.id;
  }

  private recordSeen(id: string): void {
    const now = performance.now();
    if (now - (this.lastSeenWrites.get(id) ?? Number.NEGATIVE_INFINITY) < SEEN_INTERVAL_MS) {
      return;
    }
    this.remember(id, now);
    this.store.markSeen(id, new Date()).catch((error: unknown) => {
      this.failedSeenWrites.failure(
        (failures) => `could not update lastSeen (${failures} failed updates so far): ${errorMessage(error)}`,
      );
    });
  }

  private remember(id: string, now: number): void {
    if (now - this.lastSweep >= SEEN_INTERVAL_MS) {
      this.lastSweep = now;
      for (const [rememberedId, at] of this.lastSeenWrites) {
        if (now - at >= SEEN_INTERVAL_MS) {
          this.lastSeenWrites.delete(rememberedId);
        }
      }
    }
    this.lastSeenWrites.set(id, now);
  }
}

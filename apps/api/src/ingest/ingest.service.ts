import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import mqtt, { MqttClient } from 'mqtt';
import { RawSignal, SIGNAL_TOPIC_WILDCARD } from '@marauder/shared';
import { ResolutionService } from '../resolution/resolution.service';
import { PositionService } from '../position/position.service';

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestService.name);
  private client: MqttClient | null = null;

  constructor(
    private readonly resolution: ResolutionService,
    private readonly position: PositionService,
  ) {}

  onModuleInit(): void {
    const url = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
    const client = mqtt.connect(url);
    this.client = client;
    client.on('connect', () => {
      client.subscribe(SIGNAL_TOPIC_WILDCARD, (err) => {
        if (err) {
          this.logger.error(`subscribe failed: ${err.message}`);
        }
      });
    });
    client.on('message', (_topic, payload) => {
      void this.handle(payload);
    });
    client.on('error', (err) => this.logger.error(err.message));
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  private async handle(payload: Buffer): Promise<void> {
    const signal = this.parse(payload);
    if (!signal) {
      return;
    }
    try {
      const entity = await this.resolution.resolve(signal.fingerprint);
      this.position.record(entity, signal);
    } catch (err) {
      this.logger.error(`handle failed: ${(err as Error).message}`);
    }
  }

  private parse(payload: Buffer): RawSignal | null {
    try {
      const raw = JSON.parse(payload.toString()) as Partial<RawSignal>;
      if (
        typeof raw.fingerprint !== 'string' ||
        typeof raw.receiverId !== 'string' ||
        typeof raw.rssi !== 'number' ||
        typeof raw.txPower !== 'number'
      ) {
        return null;
      }
      return {
        fingerprint: raw.fingerprint,
        receiverId: raw.receiverId,
        rssi: raw.rssi,
        txPower: raw.txPower,
        ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
      };
    } catch {
      return null;
    }
  }
}

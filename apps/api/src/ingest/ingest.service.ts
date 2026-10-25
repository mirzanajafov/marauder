import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { RawSignal, SIGNAL_TOPIC_WILDCARD } from '@marauder/shared';
import { ResolutionService } from '../resolution/resolution.service';
import { PositionService } from '../position/position.service';
import { EnvironmentVariables } from '../config/env.validation';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestService.name);
  private readonly failedSignals = new ThrottledLog(this.logger);
  private readonly mqttUrl: string;
  private client: MqttClient | null = null;

  constructor(
    private readonly resolution: ResolutionService,
    private readonly position: PositionService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.mqttUrl = config.get('MQTT_URL', { infer: true });
  }

  onModuleInit(): void {
    const client = mqtt.connect(this.mqttUrl);
    this.client = client;
    client.on('connect', () => {
      client.subscribe(SIGNAL_TOPIC_WILDCARD, (error) => {
        if (error) {
          this.logger.error(`subscribe failed: ${error.message}`);
        }
      });
    });
    client.on('message', (_topic, payload) => {
      void this.handle(payload);
    });
    client.on('error', (error) => this.logger.error(error.message));
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
    } catch (error) {
      this.failedSignals.failure(
        (failures) => `could not handle a signal (${failures} failed signals so far): ${errorMessage(error)}`,
      );
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

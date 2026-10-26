import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { SIGNAL_TOPIC_WILDCARD } from '@marauder/shared';
import { ResolutionService } from '../entities/resolution.service';
import { PositionService } from '../position/position.service';
import { EnvironmentVariables } from '../config/env.validation';
import { errorMessage } from '../common/error-message';
import { ThrottledLog } from '../common/throttled-log';
import { parseSignal } from './parse-signal';

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestService.name);
  private readonly failedSignals = new ThrottledLog(this.logger);
  private readonly rejectedSignals = new ThrottledLog(this.logger);
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
    client.on('message', (topic, payload, packet) => {
      void this.handle(topic, payload, packet.retain);
    });
    client.on('error', (error) => this.logger.error(error.message));
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  private async handle(topic: string, payload: Buffer, retained: boolean): Promise<void> {
    const receivedAt = Date.now();
    const signal = retained ? null : parseSignal(payload);
    if (!signal) {
      this.rejectedSignals.failure(
        (rejected) => `signals rejected so far: ${rejected}, the latest on ${JSON.stringify(topic)}`,
      );
      return;
    }
    try {
      const entity = await this.resolution.resolve(signal.fingerprint);
      this.position.record(entity, { ...signal, ts: receivedAt });
    } catch (error) {
      this.failedSignals.failure(
        (failures) => `could not handle a signal (${failures} failed signals so far): ${errorMessage(error)}`,
      );
    }
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }));
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}

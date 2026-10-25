import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { IngestService } from './ingest/ingest.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

export interface Health {
  status: 'ok' | 'down';
  checks: { database: boolean; redis: boolean; mqtt: boolean };
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ingest: IngestService,
  ) {}

  @Get()
  async check(): Promise<Health> {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    const checks = { database, redis: this.redis.client.status === 'ready', mqtt: this.ingest.connected };
    if (!checks.database || !checks.redis || !checks.mqtt) {
      throw new ServiceUnavailableException({ status: 'down', checks } satisfies Health);
    }
    return { status: 'ok', checks };
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReceiversModule } from './receivers/receivers.module';
import { EntitiesModule } from './entities/entities.module';
import { ResolutionModule } from './resolution/resolution.module';
import { PositionModule } from './position/position.module';
import { TrackingModule } from './tracking/tracking.module';
import { IngestModule } from './ingest/ingest.module';
import { HistoryModule } from './history/history.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    RedisModule,
    PrismaModule,
    ReceiversModule,
    EntitiesModule,
    ResolutionModule,
    PositionModule,
    TrackingModule,
    IngestModule,
    HistoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

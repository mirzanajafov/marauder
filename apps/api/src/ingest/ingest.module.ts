import { Module } from '@nestjs/common';
import { EntitiesModule } from '../entities/entities.module';
import { PositionModule } from '../position/position.module';
import { IngestService } from './ingest.service';

@Module({
  imports: [EntitiesModule, PositionModule],
  providers: [IngestService],
})
export class IngestModule {}

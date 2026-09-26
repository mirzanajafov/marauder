import { Module } from '@nestjs/common';
import { ResolutionModule } from '../resolution/resolution.module';
import { PositionModule } from '../position/position.module';
import { IngestService } from './ingest.service';

@Module({
  imports: [ResolutionModule, PositionModule],
  providers: [IngestService],
})
export class IngestModule {}

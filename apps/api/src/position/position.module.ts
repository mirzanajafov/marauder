import { Module } from '@nestjs/common';
import { FloorPlanModule } from '../floorplan/floorplan.module';
import { ReceiversModule } from '../receivers/receivers.module';
import { PositionService } from './position.service';

@Module({
  imports: [ReceiversModule, FloorPlanModule],
  providers: [PositionService],
  exports: [PositionService],
})
export class PositionModule {}

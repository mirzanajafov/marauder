import { Module } from '@nestjs/common';
import { FloorPlanService } from './floorplan.service';
import { FloorPlanController } from './floorplan.controller';

@Module({
  providers: [FloorPlanService],
  controllers: [FloorPlanController],
  exports: [FloorPlanService],
})
export class FloorPlanModule {}

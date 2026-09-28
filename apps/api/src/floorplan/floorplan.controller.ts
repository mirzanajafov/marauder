import { Body, Controller, Get, Put } from '@nestjs/common';
import { FloorPlan } from '@marauder/shared';
import { FloorPlanService } from './floorplan.service';
import { UpdateFloorPlanDto } from './dto/update-floorplan.dto';

@Controller('floorplan')
export class FloorPlanController {
  constructor(private readonly floorplan: FloorPlanService) {}

  @Get()
  get(): Promise<FloorPlan> {
    return this.floorplan.get();
  }

  @Put()
  update(@Body() body: UpdateFloorPlanDto): Promise<FloorPlan> {
    return this.floorplan.update(body);
  }
}

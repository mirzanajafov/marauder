import { Injectable } from '@nestjs/common';
import { DEFAULT_FLOORPLAN_ID, FLOOR, FloorPlan } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFloorPlanDto } from './dto/update-floorplan.dto';

const FLOOR_PLAN_FIELDS = { imageUrl: true, width: true, height: true, floor: true } as const;

@Injectable()
export class FloorPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<FloorPlan> {
    const plan = await this.prisma.floorPlan.findUnique({
      where: { id: DEFAULT_FLOORPLAN_ID },
      select: FLOOR_PLAN_FIELDS,
    });
    return plan ?? { imageUrl: null, width: FLOOR.width, height: FLOOR.height, floor: 0 };
  }

  update(dto: UpdateFloorPlanDto): Promise<FloorPlan> {
    const data = {
      imageUrl: dto.imageUrl ?? null,
      width: dto.width,
      height: dto.height,
      floor: dto.floor ?? 0,
    };
    return this.prisma.floorPlan.upsert({
      where: { id: DEFAULT_FLOORPLAN_ID },
      update: data,
      create: { id: DEFAULT_FLOORPLAN_ID, ...data },
      select: FLOOR_PLAN_FIELDS,
    });
  }
}

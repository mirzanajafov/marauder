import { Injectable } from '@nestjs/common';
import { DEFAULT_FLOORPLAN_ID, FLOOR, FloorPlan } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFloorPlanDto } from './dto/update-floorplan.dto';

@Injectable()
export class FloorPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<FloorPlan> {
    const row = await this.prisma.floorPlan.findUnique({ where: { id: DEFAULT_FLOORPLAN_ID } });
    if (!row) {
      return { imageUrl: null, width: FLOOR.width, height: FLOOR.height, floor: 0 };
    }
    return { imageUrl: row.imageUrl, width: row.width, height: row.height, floor: row.floor };
  }

  async update(dto: UpdateFloorPlanDto): Promise<FloorPlan> {
    const data = {
      imageUrl: dto.imageUrl ?? null,
      width: dto.width,
      height: dto.height,
      floor: dto.floor ?? 0,
    };
    const row = await this.prisma.floorPlan.upsert({
      where: { id: DEFAULT_FLOORPLAN_ID },
      update: data,
      create: { id: DEFAULT_FLOORPLAN_ID, ...data },
    });
    return { imageUrl: row.imageUrl, width: row.width, height: row.height, floor: row.floor };
  }
}

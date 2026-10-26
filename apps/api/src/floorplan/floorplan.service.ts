import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEFAULT_FLOORPLAN, DEFAULT_FLOORPLAN_ID, FloorPlan } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFloorPlanDto } from './dto/update-floorplan.dto';
import { FLOOR_PLAN_CHANGED } from './floorplan.events';

const FLOOR_PLAN_FIELDS = { imageUrl: true, width: true, height: true, floor: true } as const;

@Injectable()
export class FloorPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async get(): Promise<FloorPlan> {
    const plan = await this.prisma.floorPlan.findUnique({
      where: { id: DEFAULT_FLOORPLAN_ID },
      select: FLOOR_PLAN_FIELDS,
    });
    return plan ?? { ...DEFAULT_FLOORPLAN };
  }

  async update(dto: UpdateFloorPlanDto): Promise<FloorPlan> {
    const data = {
      imageUrl: dto.imageUrl ?? null,
      width: dto.width,
      height: dto.height,
      floor: dto.floor ?? 0,
    };
    const plan = await this.prisma.floorPlan.upsert({
      where: { id: DEFAULT_FLOORPLAN_ID },
      update: data,
      create: { id: DEFAULT_FLOORPLAN_ID, ...data },
      select: FLOOR_PLAN_FIELDS,
    });
    this.events.emit(FLOOR_PLAN_CHANGED);
    return plan;
  }
}

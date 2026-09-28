import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Entity } from '@marauder/shared';
import { EntitiesService } from './entities.service';
import { TagEntityDto } from './dto/tag-entity.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  list(): Promise<Entity[]> {
    return this.entities.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Entity> {
    return this.entities.get(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  tag(@Param('id') id: string, @Body() body: TagEntityDto): Promise<Entity> {
    return this.entities.tag(id, body);
  }
}

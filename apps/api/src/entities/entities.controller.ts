import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Entity } from '@marauder/shared';
import { EntitiesService } from './entities.service';
import { TagEntityDto } from './dto/tag-entity.dto';

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
  tag(@Param('id') id: string, @Body() body: TagEntityDto): Promise<Entity> {
    return this.entities.tag(id, body);
  }
}

import { Module } from '@nestjs/common';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { EntityStore } from './entity.store';
import { ResolutionService } from './resolution.service';

@Module({
  providers: [EntityStore, EntitiesService, ResolutionService],
  controllers: [EntitiesController],
  exports: [ResolutionService],
})
export class EntitiesModule {}

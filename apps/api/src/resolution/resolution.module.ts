import { Module } from '@nestjs/common';
import { ResolutionService } from './resolution.service';

@Module({
  providers: [ResolutionService],
  exports: [ResolutionService],
})
export class ResolutionModule {}

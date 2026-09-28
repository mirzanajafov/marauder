import { Module } from '@nestjs/common';
import { ReceiversModule } from '../receivers/receivers.module';
import { PositionService } from './position.service';

@Module({
  imports: [ReceiversModule],
  providers: [PositionService],
  exports: [PositionService],
})
export class PositionModule {}

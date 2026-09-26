import { Module } from '@nestjs/common';
import { ReceiversService } from './receivers.service';
import { ReceiversController } from './receivers.controller';

@Module({
  providers: [ReceiversService],
  controllers: [ReceiversController],
  exports: [ReceiversService],
})
export class ReceiversModule {}

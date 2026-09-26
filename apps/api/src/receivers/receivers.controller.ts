import { Controller, Get } from '@nestjs/common';
import { Receiver } from '@marauder/shared';
import { ReceiversService } from './receivers.service';

@Controller('receivers')
export class ReceiversController {
  constructor(private readonly receivers: ReceiversService) {}

  @Get()
  list(): Promise<Receiver[]> {
    return this.receivers.list();
  }
}

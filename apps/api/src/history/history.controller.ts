import { Controller, Get, Query } from '@nestjs/common';
import { HistoryPoint, HistorySummary } from '@marauder/shared';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';

@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get('summary')
  summary(): Promise<HistorySummary> {
    return this.history.summary();
  }

  @Get()
  query(@Query() q: HistoryQueryDto): Promise<HistoryPoint[]> {
    return this.history.query(q.from, q.to, q.bucketMs);
  }
}

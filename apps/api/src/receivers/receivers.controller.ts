import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Receiver } from '@marauder/shared';
import { ReceiversService } from './receivers.service';
import { CreateReceiverDto } from './dto/create-receiver.dto';
import { UpdateReceiverDto } from './dto/update-receiver.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('receivers')
export class ReceiversController {
  constructor(private readonly receivers: ReceiversService) {}

  @Get()
  list(): Promise<Receiver[]> {
    return this.receivers.list();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: CreateReceiverDto): Promise<Receiver> {
    return this.receivers.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() body: UpdateReceiverDto): Promise<Receiver> {
    return this.receivers.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.receivers.remove(id);
  }
}

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Receiver } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiverDto } from './dto/create-receiver.dto';
import { UpdateReceiverDto } from './dto/update-receiver.dto';
import { RECEIVERS_CHANGED } from './receivers.events';

@Injectable()
export class ReceiversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  list(): Promise<Receiver[]> {
    return this.prisma.receiver.findMany({ orderBy: { id: 'asc' } });
  }

  async create(dto: CreateReceiverDto): Promise<Receiver> {
    const receiver = await this.prisma.receiver.create({ data: dto });
    this.events.emit(RECEIVERS_CHANGED);
    return receiver;
  }

  async update(id: string, dto: UpdateReceiverDto): Promise<Receiver> {
    const receiver = await this.prisma.receiver.update({ where: { id }, data: dto });
    this.events.emit(RECEIVERS_CHANGED);
    return receiver;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.receiver.delete({ where: { id } });
    this.events.emit(RECEIVERS_CHANGED);
  }
}

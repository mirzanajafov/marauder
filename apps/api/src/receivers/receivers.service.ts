import { Injectable } from '@nestjs/common';
import { Receiver } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiverDto } from './dto/create-receiver.dto';
import { UpdateReceiverDto } from './dto/update-receiver.dto';

@Injectable()
export class ReceiversService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Receiver[]> {
    return this.prisma.receiver.findMany({ orderBy: { id: 'asc' } });
  }

  create(dto: CreateReceiverDto): Promise<Receiver> {
    return this.prisma.receiver.create({ data: dto });
  }

  update(id: string, dto: UpdateReceiverDto): Promise<Receiver> {
    return this.prisma.receiver.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.receiver.delete({ where: { id } });
  }
}

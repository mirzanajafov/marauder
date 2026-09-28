import { Injectable, NotFoundException } from '@nestjs/common';
import { Receiver } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiverDto } from './dto/create-receiver.dto';
import { UpdateReceiverDto } from './dto/update-receiver.dto';

@Injectable()
export class ReceiversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Receiver[]> {
    const rows = await this.prisma.receiver.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => ({ id: r.id, name: r.name, x: r.x, y: r.y, floor: r.floor }));
  }

  async create(dto: CreateReceiverDto): Promise<Receiver> {
    const row = await this.prisma.receiver.create({
      data: { id: dto.id, name: dto.name, x: dto.x, y: dto.y, floor: dto.floor ?? 0 },
    });
    return { id: row.id, name: row.name, x: row.x, y: row.y, floor: row.floor };
  }

  async update(id: string, dto: UpdateReceiverDto): Promise<Receiver> {
    const exists = await this.prisma.receiver.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`receiver ${id} not found`);
    }
    const row = await this.prisma.receiver.update({
      where: { id },
      data: { name: dto.name, x: dto.x, y: dto.y, floor: dto.floor },
    });
    return { id: row.id, name: row.name, x: row.x, y: row.y, floor: row.floor };
  }

  async remove(id: string): Promise<void> {
    const exists = await this.prisma.receiver.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`receiver ${id} not found`);
    }
    await this.prisma.receiver.delete({ where: { id } });
  }
}

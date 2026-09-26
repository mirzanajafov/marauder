import { Injectable } from '@nestjs/common';
import { Receiver } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Receiver[]> {
    const rows = await this.prisma.receiver.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => ({ id: r.id, name: r.name, x: r.x, y: r.y, floor: r.floor }));
  }
}

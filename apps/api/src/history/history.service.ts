import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntityStatus, HistoryPoint, HistorySummary } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryQueryDto } from './dto/history-query.dto';

interface TimeBounds {
  min: Date | null;
  max: Date | null;
}

interface PointRow {
  bucket: Date;
  entity_id: string;
  x: number;
  y: number;
  accuracy: number;
  name: string | null;
  status: EntityStatus;
}

const MAX_BUCKETS = 2_000;
const DEFAULT_WINDOW_MS = 10 * 60_000;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<HistorySummary> {
    const { min, max } = await this.bounds();
    return { from: min?.toISOString() ?? null, to: max?.toISOString() ?? null };
  }

  async query({ from, to, bucketMs }: HistoryQueryDto): Promise<HistoryPoint[]> {
    const end = to ?? (await this.bounds()).max;
    if (!end) {
      return [];
    }
    const start = from ?? new Date(end.getTime() - DEFAULT_WINDOW_MS);
    const span = end.getTime() - start.getTime();
    if (span < 0) {
      if (to === undefined) {
        return [];
      }
      throw new BadRequestException('from must not be after to');
    }
    if (span / bucketMs > MAX_BUCKETS) {
      throw new BadRequestException(`at most ${MAX_BUCKETS} buckets per request: shorten the window or widen bucketMs`);
    }

    const rows = await this.prisma.$queryRaw<PointRow[]>(
      Prisma.sql`
        SELECT time_bucket(make_interval(secs => ${bucketMs}::double precision / 1000.0), p.time) AS bucket,
               p.entity_id,
               avg(p.x) AS x,
               avg(p.y) AS y,
               avg(p.accuracy) AS accuracy,
               e.name,
               e.status
        FROM positions p
        JOIN entities e ON e.id = p.entity_id
        WHERE p.time BETWEEN ${start} AND ${end}
        GROUP BY bucket, p.entity_id, e.name, e.status
        ORDER BY bucket ASC
      `,
    );

    return rows.map((r) => ({
      entityId: r.entity_id,
      x: r.x,
      y: r.y,
      accuracy: r.accuracy,
      time: r.bucket.getTime(),
      name: r.name,
      status: r.status,
    }));
  }

  private async bounds(): Promise<TimeBounds> {
    const [bounds] = await this.prisma.$queryRaw<[TimeBounds]>(
      Prisma.sql`SELECT min(time) AS min, max(time) AS max FROM positions`,
    );
    return bounds;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntityStatus, HistoryPoint, HistorySummary } from '@marauder/shared';
import { PrismaService } from '../prisma/prisma.service';

interface SummaryRow {
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
  status: string;
}

export const MAX_BUCKETS = 2_000;
export const DEFAULT_WINDOW_MS = 10 * 60_000;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<HistorySummary> {
    const rows = await this.prisma.$queryRaw<SummaryRow[]>(
      Prisma.sql`SELECT min(time) AS min, max(time) AS max FROM positions`,
    );
    const row = rows[0];
    return {
      from: row?.min ? row.min.toISOString() : null,
      to: row?.max ? row.max.toISOString() : null,
    };
  }

  async query(from?: string, to?: string, bucketMs = 500): Promise<HistoryPoint[]> {
    let end = to ? new Date(to) : null;
    if (!end) {
      const bounds = await this.summary();
      if (!bounds.to) {
        return [];
      }
      end = new Date(bounds.to);
    }
    const start = from ? new Date(from) : new Date(end.getTime() - DEFAULT_WINDOW_MS);
    const span = end.getTime() - start.getTime();
    if (span < 0) {
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
      x: Number(r.x),
      y: Number(r.y),
      accuracy: Number(r.accuracy),
      time: r.bucket.getTime(),
      name: r.name,
      status: r.status as EntityStatus,
    }));
  }
}

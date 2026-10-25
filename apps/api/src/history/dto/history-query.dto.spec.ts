import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HistoryQueryDto } from './history-query.dto';

function parse(query: Record<string, string>): { query: HistoryQueryDto; invalid: string[] } {
  const parsed = plainToInstance(HistoryQueryDto, query);
  return { query: parsed, invalid: validateSync(parsed).map((error) => error.property) };
}

describe('HistoryQueryDto', () => {
  it.each(['yesterday', '1', '2026-02-30T00:00:00Z', '2026-10-25T10:00:00', '2026-10-25', '2026-W43'])(
    'refuses %s as a window bound',
    (from) => {
      expect(parse({ from }).invalid).toEqual(['from']);
    },
  );

  it('defaults to 500 ms buckets and no bounds', () => {
    expect(parse({})).toEqual({ query: { bucketMs: 500 }, invalid: [] });
  });

  it('reads a timestamp with an offset as that instant', () => {
    const { query, invalid } = parse({ from: '2026-10-25T10:00:00+02:00', to: '2026-10-25T08:30:00Z' });
    expect(invalid).toEqual([]);
    expect(query.from?.toISOString()).toBe('2026-10-25T08:00:00.000Z');
    expect(query.to?.toISOString()).toBe('2026-10-25T08:30:00.000Z');
  });
});

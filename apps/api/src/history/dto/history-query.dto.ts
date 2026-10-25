import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min, isISO8601, isRFC3339 } from 'class-validator';

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && isRFC3339(value) && isISO8601(value, { strict: true });
}

function IsTimestamp(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (isTimestamp(value) ? new Date(value) : value)),
    IsDate({ message: '$property must be an RFC 3339 timestamp such as 2026-10-25T10:00:00Z' }),
  );
}

export class HistoryQueryDto {
  @IsOptional()
  @IsTimestamp()
  from?: Date;

  @IsOptional()
  @IsTimestamp()
  to?: Date;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000)
  bucketMs = 500;
}

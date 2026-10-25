import { applyDecorators } from '@nestjs/common';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

const LOWEST_FLOOR = -10;
const HIGHEST_FLOOR = 200;

export function IsFloor(): PropertyDecorator {
  return applyDecorators(
    ValidateIf((_object: unknown, value: unknown) => value !== undefined),
    IsInt(),
    Min(LOWEST_FLOOR),
    Max(HIGHEST_FLOOR),
  );
}

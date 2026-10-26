import { applyDecorators } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { SkipIfUndefined } from './skip-if-undefined';

const LOWEST_FLOOR = -10;
const HIGHEST_FLOOR = 200;

export function IsFloor(): PropertyDecorator {
  return applyDecorators(SkipIfUndefined(), IsInt(), Min(LOWEST_FLOOR), Max(HIGHEST_FLOOR));
}

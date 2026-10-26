import { ValidateIf } from 'class-validator';

export function SkipIfUndefined(): PropertyDecorator {
  return ValidateIf((_object: unknown, value: unknown) => value !== undefined);
}

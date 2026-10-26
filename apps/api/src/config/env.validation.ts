import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min, MinLength, ValidateBy } from 'class-validator';
import { MQTT_URL_PATTERN, validateEnvironment } from '@marauder/env';
import { DEFAULT_PATH_LOSS_EXPONENT } from '@marauder/shared';

export const DEFAULT_POSITION_FLUSH_MS = 150;

function isBrowserOrigin(value: unknown): boolean {
  if (typeof value !== 'string' || !URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
}

export class EnvironmentVariables {
  @Matches(/^postgres(ql)?:\/\/\S+$/)
  DATABASE_URL!: string;

  @Matches(/^rediss?:\/\/\S+$/)
  REDIS_URL!: string;

  @Matches(MQTT_URL_PATTERN)
  MQTT_URL!: string;

  @ValidateBy({ name: 'isBrowserOrigin', validator: { validate: isBrowserOrigin } })
  WEB_ORIGIN!: string;

  @Matches(/\S/)
  @MinLength(32)
  JWT_SECRET!: string;

  @Matches(/\S/)
  @MinLength(12)
  ADMIN_PASSWORD!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 3001;

  @Matches(/^[\w/-]*$/)
  API_PREFIX = '';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  TRUST_PROXY_HOPS = 0;

  @Type(() => Number)
  @Min(1)
  @Max(10)
  PATH_LOSS_EXPONENT = DEFAULT_PATH_LOSS_EXPONENT;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(10_000)
  POSITION_FLUSH_MS = DEFAULT_POSITION_FLUSH_MS;
}

export function validateEnv(env: Record<string, unknown>): EnvironmentVariables {
  return validateEnvironment(EnvironmentVariables, env);
}

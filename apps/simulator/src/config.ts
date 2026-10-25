import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min, ValidateBy, ValidationArguments } from 'class-validator';
import { MQTT_URL_PATTERN, validateEnvironment } from '@marauder/env';
import { DEFAULT_SIM_HZ, DEFAULT_TRAFFIC, Traffic } from '@marauder/shared';

function isDwellRange(env: object): boolean {
  if (!(env instanceof SimulatorEnvironment)) {
    return false;
  }
  const { SIM_DWELL_MIN_MS: min, SIM_DWELL_MAX_MS: max } = env;
  return !Number.isFinite(min) || !Number.isFinite(max) || min <= max;
}

function DwellRange(): PropertyDecorator {
  return ValidateBy({
    name: 'dwellRange',
    validator: {
      validate: (_value: unknown, args?: ValidationArguments) => args !== undefined && isDwellRange(args.object),
    },
  });
}

class SimulatorEnvironment {
  @Matches(MQTT_URL_PATTERN)
  MQTT_URL!: string;

  @Type(() => Number)
  @Min(1)
  @Max(100)
  SIM_HZ = DEFAULT_SIM_HZ;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  SIM_TAG_COUNT = DEFAULT_TRAFFIC.tagCount;

  @Type(() => Number)
  @Min(0)
  @Max(10)
  SIM_SPEED = DEFAULT_TRAFFIC.speed;

  @Type(() => Number)
  @Min(0)
  @Max(20)
  SIM_NOISE_DB = DEFAULT_TRAFFIC.noiseDb;

  @Type(() => Number)
  @Min(0)
  @Max(1)
  SIM_DROP_PROB = DEFAULT_TRAFFIC.dropProb;

  @Type(() => Number)
  @Min(0)
  @Max(600_000)
  @DwellRange()
  SIM_DWELL_MIN_MS = DEFAULT_TRAFFIC.dwellMinMs;

  @Type(() => Number)
  @Min(0)
  @Max(600_000)
  @DwellRange()
  SIM_DWELL_MAX_MS = DEFAULT_TRAFFIC.dwellMaxMs;
}

export interface SimulatorConfig {
  mqttUrl: string;
  hz: number;
  traffic: Traffic;
}

export function loadConfig(env: Record<string, unknown>): SimulatorConfig {
  const validated = validateEnvironment(SimulatorEnvironment, env);
  return {
    mqttUrl: validated.MQTT_URL,
    hz: validated.SIM_HZ,
    traffic: {
      tagCount: validated.SIM_TAG_COUNT,
      speed: validated.SIM_SPEED,
      noiseDb: validated.SIM_NOISE_DB,
      dropProb: validated.SIM_DROP_PROB,
      dwellMinMs: validated.SIM_DWELL_MIN_MS,
      dwellMaxMs: validated.SIM_DWELL_MAX_MS,
    },
  };
}

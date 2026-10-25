import 'reflect-metadata';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export const MQTT_URL_PATTERN = /^(mqtts?|tcp|tls|ssl|wss?):\/\/\S+$/;

export function validateEnvironment<T extends object>(schema: ClassConstructor<T>, env: Record<string, unknown>): T {
  const present = Object.entries(env).filter(
    ([, value]) => value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
  );
  const parsed = plainToInstance(schema, Object.fromEntries(present));
  const errors = validateSync(parsed);
  if (errors.length > 0) {
    throw new Error(`invalid environment: ${errors.map((error) => error.property).join(', ')} missing or invalid`);
  }
  return parsed;
}

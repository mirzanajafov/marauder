import { plainToInstance } from 'class-transformer';
import { IsString, Matches, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @Matches(/\S/)
  JWT_SECRET!: string;

  @IsString()
  @Matches(/\S/)
  ADMIN_PASSWORD!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);
  if (errors.length > 0) {
    throw new Error(`invalid environment: ${errors.map((error) => error.property).join(', ')} must be set`);
  }
  return env;
}

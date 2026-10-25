import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { EnvironmentVariables } from './config/env.validation';

export function configureApp(app: NestExpressApplication): ConfigService<EnvironmentVariables, true> {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  const prefix = config.get('API_PREFIX', { infer: true });
  if (prefix) {
    app.setGlobalPrefix(prefix);
  }
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }) });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return config;
}

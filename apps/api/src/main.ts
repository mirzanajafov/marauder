import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const config = configureApp(app);
  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap();

import { Server } from 'node:http';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { LOGIN_ATTEMPTS_PER_MINUTE } from '../src/auth/auth.module';
import { configureApp } from '../src/configure-app';

const USED_UP = [...Array<number>(LOGIN_ATTEMPTS_PER_MINUTE).fill(401), 429];

describe('login rate limit behind one proxy', () => {
  let app: NestExpressApplication;
  let server: Server;

  const guess = (client: string) =>
    request(server).post('/auth/login').set('X-Forwarded-For', client).send({ password: 'not-the-password' });

  const useUpAttempts = async (client: (attempt: number) => string): Promise<number[]> => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= LOGIN_ATTEMPTS_PER_MINUTE; attempt++) {
      statuses.push((await guess(client(attempt))).status);
    }
    return statuses;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    app.set('trust proxy', 1);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a client once it used up its attempts for the minute and keeps answering other clients', async () => {
    expect(await useUpAttempts(() => '203.0.113.1')).toEqual(USED_UP);
    await guess('203.0.113.1').expect(429, {
      statusCode: 429,
      message: 'too many login attempts, try again in a minute',
    });
    await guess('203.0.113.2').expect(401);
  });

  it('keys on the address the proxy saw, so a client cannot dodge the limit with a forged X-Forwarded-For', async () => {
    expect(await useUpAttempts((attempt) => `198.51.100.${attempt}, 203.0.113.3`)).toEqual(USED_UP);
    await guess('203.0.113.3').expect(429);
    await guess('198.51.100.9, 203.0.113.4').expect(401);
  });
});

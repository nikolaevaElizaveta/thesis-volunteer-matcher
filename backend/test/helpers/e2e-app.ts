import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

export async function createE2eApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

export async function loginAs(
  app: INestApplication,
  username: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password })
    .expect(200);

  const token = res.body.access_token as string | undefined;
  if (!token) {
    throw new Error(`login failed for ${username}: no access_token`);
  }
  return token;
}

export async function clearAssignments(
  app: INestApplication,
  coordinatorToken: string,
): Promise<void> {
  await request(app.getHttpServer())
    .delete('/assignments')
    .set('Authorization', `Bearer ${coordinatorToken}`)
    .expect(200);
}

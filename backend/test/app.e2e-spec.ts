/**
 * Integration / e2e tests against a real PostgreSQL (PostGIS) database.
 *
 * Prerequisite: backend/.env with DATABASE_URL or DATABASE_HOST/… (same as local dev).
 * Docker: expose 5432 and use postgresql://postgres:postgres@localhost:5432/volunteer_matcher
 *
 * SEED is forced to true for this process so an empty DB gets demo users (demo_shelter / demo123).
 */
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

loadEnv({ path: resolve(__dirname, '../.env') });

const hasDbConfig = Boolean(
  process.env.DATABASE_URL?.trim() ||
    (process.env.DATABASE_HOST && process.env.DATABASE_NAME),
);

if (hasDbConfig) {
  process.env.SEED = 'true';
  process.env.MATCHER_URL =
    process.env.MATCHER_URL ?? 'http://127.0.0.1:59999/unused-in-these-tests';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'e2e_jwt_secret_at_least_8_chars';
}

const describeE2e = hasDbConfig ? describe : describe.skip;

describeE2e('App (e2e)', () => {
  let app: import('@nestjs/common').INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tasks without token → 401', () => {
    return request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('POST /auth/login wrong password → 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo_shelter', password: 'wrong' })
      .expect(401);
  });

  it('POST /auth/login demo_shelter → 200 + JWT + role shelter', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo_shelter', password: 'demo123' })
      .expect(200);

    expect(res.body.access_token).toBeDefined();
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.user?.role).toBe('shelter');
    expect(res.body.user?.display_name).toBe('Demo Shelter');
  });

  it('shelter creates task; owner_name forced to display name', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo_shelter', password: 'demo123' })
      .expect(200);
    const token = login.body.access_token as string;

    const body = {
      location: { lat: 59.93, lon: 30.32 },
      required_skills: ['e2e_smoke'],
      time_window: {
        start: '2026-06-01T10:00:00',
        end: '2026-06-01T18:00:00',
      },
      description: 'e2e task',
    };

    const create = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(create.body.owner_name).toMatch(/demo shelter/i);
    expect(create.body.required_skills).toContain('e2e_smoke');

    const list = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    const found = list.body.find((t: { id?: string }) => t.id === create.body.id);
    expect(found).toBeDefined();
  });

  it('volunteer POST /tasks → 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo_volunteer_alex', password: 'demo123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({
        location: { lat: 59.9, lon: 30.3 },
        required_skills: ['x'],
        time_window: {
          start: '2026-06-02T10:00:00',
          end: '2026-06-02T12:00:00',
        },
      })
      .expect(403);
  });

  it('POST /auth/register new user → 200; duplicate → 409', async () => {
    const username = `e2e_user_${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username,
        password: 'register_e2e_1',
        display_name: 'E2E Registered',
        role: 'volunteer',
      })
      .expect(200);

    expect(first.body.access_token).toBeDefined();
    expect(first.body.user?.username).toBe(username.toLowerCase());

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username,
        password: 'otherpass123',
        display_name: 'Dup',
        role: 'volunteer',
      })
      .expect(409);
  });
});

if (!hasDbConfig) {
  // eslint-disable-next-line no-console
  console.warn(
    '[e2e] Skipped: set DATABASE_URL or DATABASE_HOST+DATABASE_NAME in backend/.env',
  );
}

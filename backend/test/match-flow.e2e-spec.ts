/**
 * Full-stack flow: coordinator login → POST /match → POST /assignments (approve).
 * Requires PostgreSQL (+ PostGIS) and matcher on MATCHER_URL (default :8000).
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  clearAssignments,
  createE2eApp,
  loginAs,
} from './helpers/e2e-app';
import { isMatcherHealthy, loadE2eEnvironment } from './helpers/e2e-env';

const { hasDb } = loadE2eEnvironment();
const describeE2e = hasDb ? describe : describe.skip;

describeE2e('Match flow (e2e)', () => {
  let app: INestApplication;
  let matcherUp = false;
  let coordinatorToken: string;

  beforeAll(async () => {
    matcherUp = await isMatcherHealthy();
    if (!matcherUp) {
      // eslint-disable-next-line no-console
      console.warn(
        `[e2e] Matcher not reachable at ${process.env.MATCHER_URL} — match-flow tests will fail.`,
      );
    }
    app = await createE2eApp();
    coordinatorToken = await loginAs(app, 'coordinator', 'demo123');
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    if (!matcherUp) {
      return;
    }
    await clearAssignments(app, coordinatorToken);
  });

  it('matcher service is reachable', () => {
    expect(matcherUp).toBe(true);
  });

  it('volunteer cannot POST /match', async () => {
    const volToken = await loginAs(app, 'demo_volunteer_alex', 'demo123');
    await request(app.getHttpServer())
      .post('/match')
      .set('Authorization', `Bearer ${volToken}`)
      .send({ algorithm: 'hungarian' })
      .expect(403);
  });

  it('coordinator: match → approve → assignments visible by role', async () => {
    expect(matcherUp).toBe(true);

    const matchRes = await request(app.getHttpServer())
      .post('/match')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ algorithm: 'hungarian' })
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`POST /match expected 200/201, got ${res.status}`);
        }
      });

    expect(Array.isArray(matchRes.body.matches)).toBe(true);
    const matches = matchRes.body.matches as Array<{
      shelter_task_id: string;
      volunteer_offer_id: string;
      score?: number;
    }>;

    if (matches.length === 0) {
      // Seed may have no feasible pairs after cutoff; still a valid matcher response.
      const retry = await request(app.getHttpServer())
        .post('/match')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ algorithm: 'greedy' })
        .expect((res) => {
          if (![200, 201].includes(res.status)) {
            throw new Error(`POST /match expected 200/201, got ${res.status}`);
          }
        });
      expect(Array.isArray(retry.body.matches)).toBe(true);
      if (retry.body.matches.length === 0) {
        return;
      }
      matches.push(...retry.body.matches);
    }

    const toApprove = matches.slice(0, Math.min(2, matches.length));
    const approveRes = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        algorithm: 'hungarian',
        matches: toApprove.map((m) => ({
          shelter_task_id: m.shelter_task_id,
          volunteer_offer_id: m.volunteer_offer_id,
          score: m.score,
        })),
      })
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`POST /assignments expected 200/201, got ${res.status}`);
        }
      });

    expect(approveRes.body.length).toBeGreaterThanOrEqual(toApprove.length);

    const allAsCoordinator = await request(app.getHttpServer())
      .get('/assignments')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(200);

    for (const m of toApprove) {
      expect(
        allAsCoordinator.body.some(
          (a: { shelter_task_id: string; volunteer_offer_id: string }) =>
            a.shelter_task_id === m.shelter_task_id &&
            a.volunteer_offer_id === m.volunteer_offer_id,
        ),
      ).toBe(true);
    }

    const offersRes = await request(app.getHttpServer())
      .get('/offers')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(200);

    const offers = offersRes.body as Array<{ id: string; description?: string }>;
    const alexOfferIds = new Set(
      offers
        .filter((o) => o.description?.trim().toLowerCase() === 'demo volunteer alex')
        .map((o) => o.id),
    );
    const samOfferIds = new Set(
      offers
        .filter((o) => o.description?.trim().toLowerCase() === 'demo volunteer sam')
        .map((o) => o.id),
    );

    const alexToken = await loginAs(app, 'demo_volunteer_alex', 'demo123');
    const samToken = await loginAs(app, 'demo_volunteer_sam', 'demo123');

    const alexAssignments = await request(app.getHttpServer())
      .get('/assignments')
      .set('Authorization', `Bearer ${alexToken}`)
      .expect(200);

    const samAssignments = await request(app.getHttpServer())
      .get('/assignments')
      .set('Authorization', `Bearer ${samToken}`)
      .expect(200);

    for (const row of alexAssignments.body as Array<{ volunteer_offer_id: string }>) {
      expect(alexOfferIds.has(row.volunteer_offer_id)).toBe(true);
    }
    for (const row of samAssignments.body as Array<{ volunteer_offer_id: string }>) {
      expect(samOfferIds.has(row.volunteer_offer_id)).toBe(true);
    }

    for (const m of toApprove) {
      if (alexOfferIds.has(m.volunteer_offer_id)) {
        expect(
          samAssignments.body.some(
            (a: { volunteer_offer_id: string }) =>
              a.volunteer_offer_id === m.volunteer_offer_id,
          ),
        ).toBe(false);
      }
      if (samOfferIds.has(m.volunteer_offer_id)) {
        expect(
          alexAssignments.body.some(
            (a: { volunteer_offer_id: string }) =>
              a.volunteer_offer_id === m.volunteer_offer_id,
          ),
        ).toBe(false);
      }
    }
  });

  it('rejects duplicate task id within one approve batch', async () => {
    const taskId = '00000000-0000-4000-8000-000000000001';
    const offerA = '00000000-0000-4000-8000-000000000002';
    const offerB = '00000000-0000-4000-8000-000000000003';

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        algorithm: 'hungarian',
        matches: [
          { shelter_task_id: taskId, volunteer_offer_id: offerA },
          { shelter_task_id: taskId, volunteer_offer_id: offerB },
        ],
      })
      .expect(400);
  });

  it('rejects approving the same task twice across requests', async () => {
    expect(matcherUp).toBe(true);
    const token = await loginAs(app, 'coordinator', 'demo123');
    await clearAssignments(app, token);

    const matchRes = await request(app.getHttpServer())
      .post('/match')
      .set('Authorization', `Bearer ${token}`)
      .send({ algorithm: 'hungarian' })
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`POST /match expected 200/201, got ${res.status}`);
        }
      });

    const matches = matchRes.body.matches as Array<{
      shelter_task_id: string;
      volunteer_offer_id: string;
      score?: number;
    }>;
    if (matches.length === 0) {
      return;
    }

    const first = matches[0];
    const firstApprove = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        algorithm: 'hungarian',
        matches: [
          {
            shelter_task_id: first.shelter_task_id,
            volunteer_offer_id: first.volunteer_offer_id,
            score: first.score,
          },
        ],
      });

    if (![200, 201].includes(firstApprove.status)) {
      throw new Error(
        `first approve failed (${firstApprove.status}): ${JSON.stringify(firstApprove.body)}`,
      );
    }

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        algorithm: 'hungarian',
        matches: [
          {
            shelter_task_id: first.shelter_task_id,
            volunteer_offer_id: first.volunteer_offer_id,
            score: first.score,
          },
        ],
      })
      .expect(400);
  });
});

if (!hasDb) {
  // eslint-disable-next-line no-console
  console.warn(
    '[e2e] match-flow skipped: set DATABASE_URL or DATABASE_HOST+DATABASE_NAME in backend/.env',
  );
}

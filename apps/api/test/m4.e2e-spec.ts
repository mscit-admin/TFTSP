/**
 * M4 DoD gates (Spec §10·M4 + §13):
 *  - SVG-as-.png document rejected by magic bytes;
 *  - Free tribe at cap → 501st person-create rejected with upgrade message;
 *  - accepted contribution raises `accepted` + recomputes accuracy; rejected raises `rejected`;
 *  - Viewer suggest in a non-enabled tribe → 403;
 *  - contributor at the pending cap → next blocked;
 *  - suggest on an out-of-scope person → 404;
 *  - stats endpoints return a coherent shape;
 *  - subscription assign/activate.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Gender, Role } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import {
  auth,
  createAdmin,
  createMember,
  createSuperAdmin,
  createTenant,
  login,
  seedPerson,
} from './utils/fixtures';
import { MinioService } from '../src/common/minio/minio.service';
import { InMemoryMinio } from './utils/in-memory-minio';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', 'utf8');

describe('M4 Documents / Subscriptions / Crowdsourcing / Stats', () => {
  let ctx: TestContext;
  let tenantId: string;
  let adminToken: string;
  let superToken: string;
  let minio: InMemoryMinio;

  const server = () => ctx.app.getHttpServer();

  const createPerson = async (token: string, firstName: string): Promise<string> => {
    const res = await request(server())
      .post('/api/v1/persons')
      .set(auth(token))
      .send({ confirmDuplicate: true, firstName, gender: 'male' })
      .expect(201);
    return res.body.id;
  };

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'm4');
    tenantId = tenant.id;
    await createAdmin(ctx.owner, tenant.id, 'admin@m4.local', Role.tribe_admin);
    await createSuperAdmin(ctx.owner, 'super@m4.local');
    adminToken = (await login(ctx.app, 'admin@m4.local', 'm4')).accessToken;
    superToken = (await login(ctx.app, 'super@m4.local')).accessToken;
    minio = ctx.app.get(MinioService) as unknown as InMemoryMinio;
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('document: valid PNG confirmed, SVG-as-.png rejected by magic bytes', async () => {
    const personId = await createPerson(adminToken, 'صاحب-الوثيقة');

    // valid PNG
    const p1 = await request(server())
      .post('/api/v1/documents/presign')
      .set(auth(adminToken))
      .send({ personId, filename: 'id.png', contentType: 'image/png', sizeBytes: PNG.length })
      .expect(201);
    minio.put(p1.body.objectKey, PNG);
    const doc = await request(server())
      .post('/api/v1/documents/confirm')
      .set(auth(adminToken))
      .send({ personId, objectKey: p1.body.objectKey, filename: 'id.png' })
      .expect(201);
    expect(doc.body.kind).toBe('image');

    // SVG masked as .png
    const p2 = await request(server())
      .post('/api/v1/documents/presign')
      .set(auth(adminToken))
      .send({ personId, filename: 'evil.png', contentType: 'image/png', sizeBytes: SVG.length })
      .expect(201);
    minio.put(p2.body.objectKey, SVG);
    const rejected = await request(server())
      .post('/api/v1/documents/confirm')
      .set(auth(adminToken))
      .send({ personId, objectKey: p2.body.objectKey, filename: 'evil.png' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.messageKey).toBe('errors.upload.svg_rejected');

    // list returns a presigned download URL
    const list = await request(server())
      .get(`/api/v1/persons/${personId}/documents`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body[0].downloadUrl).toContain('memory://get/');
  });

  it('subscription: Super Admin assigns a tier + logs the activation', async () => {
    const put = await request(server())
      .put(`/api/v1/platform/tenants/${tenantId}/subscription`)
      .set(auth(superToken))
      .send({ tier: 'basic', note: 'bank-transfer #42' })
      .expect(200);
    expect(put.body.tier).toBe('basic');
    expect(put.body.maxPersons).toBe(5000);

    const acts = await request(server())
      .get(`/api/v1/platform/tenants/${tenantId}/subscription/activations`)
      .set(auth(superToken))
      .expect(200);
    expect(acts.body.length).toBeGreaterThan(0);

    // back to free for the plan-limit gate.
    await request(server())
      .put(`/api/v1/platform/tenants/${tenantId}/subscription`)
      .set(auth(superToken))
      .send({ tier: 'free' })
      .expect(200);
  });

  it('plan limit: a Free tribe at 500 persons rejects the 501st with an upgrade message', async () => {
    const current = await ctx.owner.person.count({ where: { tenantId, deletedAt: null } });
    const toSeed = 500 - current;
    if (toSeed > 0) {
      await ctx.owner.person.createMany({
        data: Array.from({ length: toSeed }, (_, i) => ({
          id: randomUUID(),
          tenantId,
          fullName: `Bulk ${i}`,
          firstName: `Bulk${i}`,
          gender: Gender.male,
          createdBy: tenantId,
        })),
      });
    }
    const res = await request(server())
      .post('/api/v1/persons')
      .set(auth(adminToken))
      .send({ confirmDuplicate: true, firstName: 'الزائد', gender: 'male' });
    expect(res.status).toBe(403);
    expect(res.body.messageKey).toBe('errors.subscription.plan_limit_reached');
    expect(res.body.details).toMatchObject({ tier: 'free', max: 500 });
  }, 60_000);

  it('contribution reputation: accepted raises accepted+accuracy, rejected raises rejected', async () => {
    // raise the cap so person-creates for this test are allowed
    await request(server())
      .put(`/api/v1/platform/tenants/${tenantId}/subscription`)
      .set(auth(superToken))
      .send({ tier: 'professional' })
      .expect(200);

    const person = await createPerson(adminToken, 'هدف-المساهمة');
    const contributor = await createMember(ctx.owner, tenantId, 'contrib@m4.local', {
      role: Role.contributor,
      memberScope: 'tribe',
    });
    const cToken = (await login(ctx.app, 'contrib@m4.local', 'm4')).accessToken;

    const suggest = async (value: string) => {
      const cr = await request(server())
        .post('/api/v1/change-requests')
        .set(auth(cToken))
        .send({
          targetType: 'person',
          targetId: person,
          operation: 'update',
          patch: [{ op: 'replace', path: '/firstName', value }],
          contributionType: 'edit_data',
        })
        .expect(201);
      await request(server())
        .post(`/api/v1/change-requests/${cr.body.id}/submit`)
        .set(auth(cToken))
        .expect(201);
      return cr.body.id as string;
    };

    // accepted
    const cr1 = await suggest('مقبول');
    await request(server())
      .post(`/api/v1/change-requests/${cr1}/review`)
      .set(auth(adminToken))
      .send({ decision: 'approve' })
      .expect(201);

    // rejected
    const cr2 = await suggest('مرفوض');
    await request(server())
      .post(`/api/v1/change-requests/${cr2}/review`)
      .set(auth(adminToken))
      .send({ decision: 'reject' })
      .expect(201);

    const rep = await ctx.owner.contributorReputation.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId, userId: contributor.id } },
    });
    expect(rep.accepted).toBe(1);
    expect(rep.rejected).toBe(1);
    expect(rep.accuracyRate).toBeCloseTo(0.5, 5);
  });

  it('viewer contributions: 403 unless enabled, and only allowed types', async () => {
    const person = await createPerson(adminToken, 'شخص-عام');
    await createMember(ctx.owner, tenantId, 'viewer@m4.local', {
      role: Role.viewer,
      memberScope: 'tribe',
    });
    const vToken = (await login(ctx.app, 'viewer@m4.local', 'm4')).accessToken;

    const suggest = (contributionType: string) =>
      request(server())
        .post('/api/v1/change-requests')
        .set(auth(vToken))
        .send({
          targetType: 'person',
          targetId: person,
          operation: 'update',
          patch: [{ op: 'replace', path: '/laqab', value: 'x' }],
          contributionType,
        });

    // disabled by default → 403
    expect((await suggest('edit_data')).status).toBe(403);

    // enable viewer contributions
    await request(server())
      .patch('/api/v1/reputation/thresholds')
      .set(auth(adminToken))
      .send({ allowViewerContributions: true })
      .expect(200);

    expect((await suggest('edit_data')).status).toBe(201); // allowed type
    const notAllowed = await suggest('fix_relation'); // not in viewer allow-list
    expect(notAllowed.status).toBe(403);
    expect(notAllowed.body.messageKey).toBe('errors.contribution.viewer_not_allowed');
  });

  it('flood protection: a contributor at the pending cap is blocked', async () => {
    await request(server())
      .patch('/api/v1/reputation/thresholds')
      .set(auth(adminToken))
      .send({ maxPending: 2 })
      .expect(200);

    const person = await createPerson(adminToken, 'هدف-الفيضان');
    await createMember(ctx.owner, tenantId, 'flood@m4.local', {
      role: Role.contributor,
      memberScope: 'tribe',
    });
    const fToken = (await login(ctx.app, 'flood@m4.local', 'm4')).accessToken;

    const suggest = () =>
      request(server())
        .post('/api/v1/change-requests')
        .set(auth(fToken))
        .send({
          targetType: 'person',
          targetId: person,
          operation: 'update',
          patch: [{ op: 'replace', path: '/laqab', value: 'y' }],
          contributionType: 'edit_data',
        });

    await suggest().expect(201);
    await suggest().expect(201);
    const blocked = await suggest();
    expect(blocked.status).toBe(403);
    expect(blocked.body.messageKey).toBe('errors.contribution.too_many_pending');
  });

  it('out-of-scope contribution target → 404', async () => {
    const clanA = await ctx.owner.tribalUnit.create({
      data: { tenantId, unitType: 'clan', nameAr: 'أ', nameEn: 'A' },
    });
    const clanB = await ctx.owner.tribalUnit.create({
      data: { tenantId, unitType: 'clan', nameAr: 'ب', nameEn: 'B' },
    });
    const personB = await seedPerson(ctx.owner, tenantId, {
      firstName: 'خارج-النطاق',
      tribalUnitId: clanB.id,
    });
    await createMember(ctx.owner, tenantId, 'clancontrib@m4.local', {
      role: Role.contributor,
      memberScope: 'clan',
      tribalUnitId: clanA.id,
    });
    const token = (await login(ctx.app, 'clancontrib@m4.local', 'm4')).accessToken;

    const res = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(token))
      .send({
        targetType: 'person',
        targetId: personB,
        operation: 'update',
        patch: [{ op: 'replace', path: '/laqab', value: 'z' }],
        contributionType: 'edit_data',
      });
    expect(res.status).toBe(404);
  });

  it('stats: tribe + platform dashboards return a coherent shape', async () => {
    await request(server()).post('/api/v1/stats/refresh').set(auth(adminToken)).expect(200);
    const tribe = await request(server())
      .get('/api/v1/stats/tribe')
      .set(auth(adminToken))
      .expect(200);
    expect(typeof tribe.body.totalPersons).toBe('number');
    expect(Array.isArray(tribe.body.byGeneration)).toBe(true);
    expect(tribe.body).toHaveProperty('pendingChangeRequests');

    const dash = await request(server())
      .get('/api/v1/platform/stats/dashboard')
      .set(auth(superToken))
      .expect(200);
    expect(typeof dash.body.tribes).toBe('number');
    expect(Array.isArray(dash.body.byPlan)).toBe(true);
  });
});

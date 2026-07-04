/**
 * M2 Definition-of-Done gates (Spec §3 M2 / contract):
 *  1. a change request on a target modified after creation → `conflict`, not applied;
 *  2. tenant requiring 2 approvals: one approval does NOT publish;
 *  3. expired request auto-closed by the scheduled sweep + owner notified;
 *  4. every request state change persists/emits an in-app notification.
 */
import request from 'supertest';
import { Role } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createTenant, login, seedPerson } from './utils/fixtures';
import { ChangeRequestMaintenanceService } from '../src/modules/jobs/change-request-maintenance.service';

describe('M2 Change Requests & Approval Workflow (Spec §3)', () => {
  let ctx: TestContext;
  let tenantId: string;
  let adminToken: string;
  let authorToken: string;
  let reviewer1Token: string;
  let reviewer2Token: string;
  let authorId: string;

  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'm2');
    tenantId = tenant.id;

    await createAdmin(ctx.owner, tenant.id, 'admin@m2.local', Role.tribe_admin);
    const author = await createAdmin(ctx.owner, tenant.id, 'author@m2.local', Role.contributor);
    authorId = author.id;
    await createAdmin(ctx.owner, tenant.id, 'rev1@m2.local', Role.reviewer);
    await createAdmin(ctx.owner, tenant.id, 'rev2@m2.local', Role.deputy_admin);

    adminToken = (await login(ctx.app, 'admin@m2.local', 'm2')).accessToken;
    authorToken = (await login(ctx.app, 'author@m2.local', 'm2')).accessToken;
    reviewer1Token = (await login(ctx.app, 'rev1@m2.local', 'm2')).accessToken;
    reviewer2Token = (await login(ctx.app, 'rev2@m2.local', 'm2')).accessToken;
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  const setApprovalsRequired = (n: number) =>
    request(server())
      .patch('/api/v1/workflow-settings')
      .set(auth(adminToken))
      .send({ approvalsRequired: n })
      .expect(200);

  it('resolves to conflict when the target changed after the request was created', async () => {
    await setApprovalsRequired(1);
    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'أصلي' });

    // Author drafts an update CR (captures baseVersion = 1).
    const cr = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(authorToken))
      .send({
        targetType: 'person',
        targetId: personId,
        operation: 'update',
        patch: [{ op: 'replace', path: '/firstName', value: 'من-الطلب' }],
      })
      .expect(201);
    expect(cr.body.baseVersion).toBe(1);

    // Admin directly changes the same person → version bumps to 2.
    await request(server())
      .patch(`/api/v1/persons/${personId}`)
      .set(auth(adminToken))
      .send({ version: 1, firstName: 'من-المدير' })
      .expect(200);

    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(authorToken))
      .expect(201);

    // One approval (approvalsRequired = 1) triggers auto-publish → conflict.
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/review`)
      .set(auth(adminToken))
      .send({ decision: 'approve' })
      .expect(201);

    const after = await request(server())
      .get(`/api/v1/change-requests/${cr.body.id}`)
      .set(auth(authorToken))
      .expect(200);
    expect(after.body.status).toBe('conflict');

    // The patch was NOT applied; the admin's value stands.
    const person = await request(server())
      .get(`/api/v1/persons/${personId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(person.body.firstName).toBe('من-المدير');

    // Owner was notified of the conflict.
    const notes = await ctx.owner.notification.findMany({
      where: { userId: authorId, type: 'change_request_conflict' },
    });
    expect(notes.length).toBeGreaterThan(0);
  });

  it('requires the configured number of approvals before publishing', async () => {
    await setApprovalsRequired(2);
    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'قبل' });

    const cr = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(authorToken))
      .send({
        targetType: 'person',
        targetId: personId,
        operation: 'update',
        patch: [{ op: 'replace', path: '/firstName', value: 'بعد' }],
      })
      .expect(201);
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(authorToken))
      .expect(201);

    // First approval → NOT published yet.
    const firstReview = await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/review`)
      .set(auth(reviewer1Token))
      .send({ decision: 'approve' })
      .expect(201);
    expect(firstReview.body.status).toBe('under_review');

    const stillUnchanged = await request(server())
      .get(`/api/v1/persons/${personId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(stillUnchanged.body.firstName).toBe('قبل');

    // Second, distinct approval → published + applied.
    const secondReview = await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/review`)
      .set(auth(reviewer2Token))
      .send({ decision: 'approve' })
      .expect(201);
    expect(secondReview.body.status).toBe('published');

    const applied = await request(server())
      .get(`/api/v1/persons/${personId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(applied.body.firstName).toBe('بعد');
  });

  it('auto-closes expired requests via the scheduled sweep and notifies the owner', async () => {
    await setApprovalsRequired(1);
    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'منتهٍ' });

    const cr = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(authorToken))
      .send({
        targetType: 'person',
        targetId: personId,
        operation: 'update',
        patch: [{ op: 'replace', path: '/firstName', value: 'x' }],
      })
      .expect(201);
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(authorToken))
      .expect(201);

    // Force the request past its expiry, then run the sweep (as BullMQ would).
    await ctx.owner.changeRequest.update({
      where: { id: cr.body.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const maintenance = ctx.app.get(ChangeRequestMaintenanceService);
    const closed = await maintenance.runExpirySweep();
    expect(closed).toBeGreaterThan(0);

    const after = await request(server())
      .get(`/api/v1/change-requests/${cr.body.id}`)
      .set(auth(authorToken))
      .expect(200);
    expect(after.body.status).toBe('expired');

    const notes = await ctx.owner.notification.findMany({
      where: { userId: authorId, type: 'change_request_expired' },
    });
    expect(notes.length).toBeGreaterThan(0);
  });

  it('produces an in-app notification on every state change (submit + reject)', async () => {
    await setApprovalsRequired(1);
    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'إشعار' });

    const cr = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(authorToken))
      .send({
        targetType: 'person',
        targetId: personId,
        operation: 'update',
        patch: [{ op: 'replace', path: '/firstName', value: 'y' }],
      })
      .expect(201);

    const before = Date.now();
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(authorToken))
      .expect(201);

    // Reviewers were notified within 2s (persisted synchronously during submit).
    const rev1 = await ctx.owner.user.findUniqueOrThrow({ where: { email: 'rev1@m2.local' } });
    const submitNote = await ctx.owner.notification.findFirst({
      where: {
        userId: rev1.id,
        type: 'change_request_submitted',
        payload: { path: ['changeRequestId'], equals: cr.body.id },
      },
    });
    expect(submitNote).not.toBeNull();
    expect(Date.now() - before).toBeLessThan(2000);

    // Reject → owner notified.
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/review`)
      .set(auth(reviewer1Token))
      .send({ decision: 'reject' })
      .expect(201);

    const rejectNote = await ctx.owner.notification.findFirst({
      where: {
        userId: authorId,
        type: 'change_request_rejected',
        payload: { path: ['changeRequestId'], equals: cr.body.id },
      },
    });
    expect(rejectNote).not.toBeNull();

    // The notifications API returns the owner's list + unread count.
    const list = await request(server())
      .get('/api/v1/notifications')
      .set(auth(authorToken))
      .expect(200);
    expect(list.body).toHaveProperty('unread');
    expect(Array.isArray(list.body.data)).toBe(true);
  });

  it('forbids a reviewer from approving their own request', async () => {
    await setApprovalsRequired(1);
    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'ذاتي' });
    // rev1 (a reviewer) authors a request, then tries to review it.
    const cr = await request(server())
      .post('/api/v1/change-requests')
      .set(auth(reviewer1Token))
      .send({
        targetType: 'person',
        targetId: personId,
        operation: 'update',
        patch: [{ op: 'replace', path: '/firstName', value: 'z' }],
      })
      .expect(201);
    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(reviewer1Token))
      .expect(201);

    const res = await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/review`)
      .set(auth(reviewer1Token))
      .send({ decision: 'approve' });
    expect(res.status).toBe(403);
    expect(res.body.messageKey).toBe('errors.change_request.cannot_review_own');
  });
});

/**
 * M5 Definition-of-Done gates (Spec §3·M5, backend slice):
 *  1. device registration happy path (POST /devices) returns the row;
 *  2. re-registering the same token UPSERTS (no duplicate; owner/platform/lastSeen refresh);
 *  3. deregister (DELETE /devices/:token) removes it and is idempotent;
 *  4. notification dispatch still works with FCM DISABLED (no credentials) — no crash,
 *     the in-app notification is persisted, and the FCM channel is a safe no-op.
 */
import request from 'supertest';
import { Role } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createTenant, login, seedPerson } from './utils/fixtures';
import { FcmService } from '../src/modules/notifications/channels/fcm.service';

describe('M5 Device registration & FCM push (Spec §3·M5)', () => {
  let ctx: TestContext;
  let tenantId: string;
  let adminId: string;
  let adminToken: string;
  let authorToken: string;

  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'm5');
    tenantId = tenant.id;

    const admin = await createAdmin(ctx.owner, tenant.id, 'admin@m5.local', Role.tribe_admin);
    adminId = admin.id;
    await createAdmin(ctx.owner, tenant.id, 'author@m5.local', Role.contributor);

    adminToken = (await login(ctx.app, 'admin@m5.local', 'm5')).accessToken;
    authorToken = (await login(ctx.app, 'author@m5.local', 'm5')).accessToken;
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('FCM is disabled when no credentials are configured', () => {
    expect(ctx.app.get(FcmService).isEnabled()).toBe(false);
  });

  it('registers a device (happy path)', async () => {
    const res = await request(server())
      .post('/api/v1/devices')
      .set(auth(authorToken))
      .send({ token: 'fcm-token-A', platform: 'android' })
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(res.body.token).toBe('fcm-token-A');
    expect(res.body.platform).toBe('android');
    expect(res.body.userId).toBeDefined();

    const rows = await ctx.owner.deviceRegistration.findMany({ where: { token: 'fcm-token-A' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tenantId).toBe(tenantId);
  });

  it('upserts by token on re-registration (no duplicate row)', async () => {
    const first = await ctx.owner.deviceRegistration.findFirstOrThrow({
      where: { token: 'fcm-token-A' },
    });

    const res = await request(server())
      .post('/api/v1/devices')
      .set(auth(authorToken))
      .send({ token: 'fcm-token-A', platform: 'ios' })
      .expect(200);

    expect(res.body.id).toBe(first.id); // same row
    expect(res.body.platform).toBe('ios'); // refreshed

    const rows = await ctx.owner.deviceRegistration.findMany({ where: { token: 'fcm-token-A' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastSeenAt.getTime()).toBeGreaterThanOrEqual(first.lastSeenAt.getTime());
  });

  it('deregisters a device and is idempotent', async () => {
    const first = await request(server())
      .delete('/api/v1/devices/fcm-token-A')
      .set(auth(authorToken))
      .expect(200);
    expect(first.body.removed).toBe(1);

    const rows = await ctx.owner.deviceRegistration.findMany({ where: { token: 'fcm-token-A' } });
    expect(rows).toHaveLength(0);

    // A second delete is a safe no-op (removed = 0).
    const second = await request(server())
      .delete('/api/v1/devices/fcm-token-A')
      .set(auth(authorToken))
      .expect(200);
    expect(second.body.removed).toBe(0);
  });

  it('dispatches notifications with FCM disabled without crashing', async () => {
    // A device is registered for the reviewer/admin — the FCM channel must still no-op safely.
    await request(server())
      .post('/api/v1/devices')
      .set(auth(adminToken))
      .send({ token: 'fcm-token-admin', platform: 'android' })
      .expect(200);

    const personId = await seedPerson(ctx.owner, tenantId, { firstName: 'إشعار' });

    // Submitting a change request notifies reviewers → runs every channel, incl. FCM.
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

    await request(server())
      .post(`/api/v1/change-requests/${cr.body.id}/submit`)
      .set(auth(authorToken))
      .expect(201);

    // The dispatch completed (no throw) and the in-app notification was persisted.
    const notes = await ctx.owner.notification.findMany({
      where: { tenantId, userId: adminId, type: 'change_request_submitted' },
    });
    expect(notes.length).toBeGreaterThan(0);

    // The registered device survives (FCM disabled → no send, no prune).
    const devices = await ctx.owner.deviceRegistration.findMany({
      where: { token: 'fcm-token-admin' },
    });
    expect(devices).toHaveLength(1);
  });
});

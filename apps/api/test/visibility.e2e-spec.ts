/**
 * M3 Visibility & Privacy DoD gates (Spec §10·M3 / contract):
 *  1. clan-scoped member requests a person in another clan → 404;
 *  2. women-hidden tenant → external Viewer search/tree returns no women;
 *  3. blocked fields ABSENT from response JSON (key absence, not null);
 *  4. temporary grant past valid_to → 401 with an expiry message.
 * Plus: the resolver is applied uniformly (redaction on /tree + search, not only /persons/:id).
 */
import request from 'supertest';
import { Gender, Role } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createMember, createTenant, login, seedPerson } from './utils/fixtures';

describe('M3 Visibility & Privacy (Spec §3·M3)', () => {
  let ctx: TestContext;
  let tenantId: string;
  let adminToken: string;
  let clanAId: string;
  let clanBId: string;

  const server = () => ctx.app.getHttpServer();

  const setSettings = (data: Record<string, unknown>) =>
    ctx.owner.visibilitySettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'vis');
    tenantId = tenant.id;
    await createAdmin(ctx.owner, tenant.id, 'admin@vis.local', Role.tribe_admin);
    adminToken = (await login(ctx.app, 'admin@vis.local', 'vis')).accessToken;

    const clanA = await ctx.owner.tribalUnit.create({
      data: { tenantId, unitType: 'clan', nameAr: 'فخذ أ', nameEn: 'Clan A' },
    });
    const clanB = await ctx.owner.tribalUnit.create({
      data: { tenantId, unitType: 'clan', nameAr: 'فخذ ب', nameEn: 'Clan B' },
    });
    clanAId = clanA.id;
    clanBId = clanB.id;
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('gate 1 — a clan-scoped member gets 404 for a person in another clan', async () => {
    await setSettings({
      level: 'members',
      womenDisplay: 'with_siblings',
      defaultMemberScope: 'tribe',
    });
    const personA = await seedPerson(ctx.owner, tenantId, {
      firstName: 'أ-من-الفخذ',
      tribalUnitId: clanAId,
    });
    const personB = await seedPerson(ctx.owner, tenantId, {
      firstName: 'ب-من-الفخذ',
      tribalUnitId: clanBId,
    });

    await createMember(ctx.owner, tenantId, 'clanmember@vis.local', {
      role: Role.viewer,
      memberScope: 'clan',
      tribalUnitId: clanAId,
    });
    const token = (await login(ctx.app, 'clanmember@vis.local', 'vis')).accessToken;

    await request(server()).get(`/api/v1/persons/${personA}`).set(auth(token)).expect(200);
    // Another clan ⇒ 404 (existence not leaked as 403).
    await request(server()).get(`/api/v1/persons/${personB}`).set(auth(token)).expect(404);
  });

  it('gate 2 — women-hidden: an external Viewer search/tree returns no women', async () => {
    await setSettings({ level: 'members', womenDisplay: 'hidden', defaultMemberScope: 'tribe' });
    const root = await seedPerson(ctx.owner, tenantId, {
      firstName: 'رجل-جذر',
      gender: Gender.male,
    });
    await seedPerson(ctx.owner, tenantId, {
      firstName: 'امرأة-مخفية',
      gender: Gender.female,
      fatherId: root,
    });
    await seedPerson(ctx.owner, tenantId, {
      firstName: 'ابن-ظاهر',
      gender: Gender.male,
      fatherId: root,
    });

    await createMember(ctx.owner, tenantId, 'external@vis.local', {
      role: Role.viewer,
      memberScope: 'tribe', // sees the whole (men-only, given women-hidden + no relation)
    });
    const token = (await login(ctx.app, 'external@vis.local', 'vis')).accessToken;

    const list = await request(server()).get('/api/v1/persons').set(auth(token)).expect(200);
    const genders = (list.body.data as Array<{ gender: string }>).map((p) => p.gender);
    expect(genders).not.toContain('female');

    // Search path is redacted too.
    const search = await request(server())
      .get('/api/v1/persons?q=%D8%A7%D9%85%D8%B1%D8%A3%D8%A9') // "امرأة"
      .set(auth(token))
      .expect(200);
    expect((search.body.data as Array<{ gender: string }>).some((p) => p.gender === 'female')).toBe(
      false,
    );

    // Tree path is redacted too — no female nodes.
    const tree = await request(server())
      .get(`/api/v1/tree?rootId=${root}&generations=3`)
      .set(auth(token))
      .expect(200);
    expect((tree.body.nodes as Array<{ gender: string }>).some((n) => n.gender === 'female')).toBe(
      false,
    );
  });

  it('gate 3 — blocked fields are ABSENT from the JSON (not null)', async () => {
    await setSettings({
      level: 'members',
      womenDisplay: 'with_siblings',
      showPhotos: false,
      showBirthDates: false,
      defaultMemberScope: 'tribe',
    });
    const personId = await seedPerson(ctx.owner, tenantId, {
      firstName: 'له-صورة',
      photoKey: 'photos/x.jpg',
      birthDate: new Date('1980-01-01'),
    });
    await createMember(ctx.owner, tenantId, 'reader@vis.local', {
      role: Role.viewer,
      memberScope: 'tribe',
    });
    const token = (await login(ctx.app, 'reader@vis.local', 'vis')).accessToken;

    const res = await request(server())
      .get(`/api/v1/persons/${personId}`)
      .set(auth(token))
      .expect(200);
    expect('photoKey' in res.body).toBe(false);
    expect('birthDate' in res.body).toBe(false);
    // an admin still sees them (bypass).
    const adminRes = await request(server())
      .get(`/api/v1/persons/${personId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(adminRes.body.photoKey).toBe('photos/x.jpg');
  });

  it('gate 4 — a temporary grant past valid_to → 401 with an expiry message', async () => {
    await setSettings({
      level: 'members',
      womenDisplay: 'with_siblings',
      defaultMemberScope: 'tribe',
    });
    const future = new Date(Date.now() + 3_600_000);
    const viewer = await createMember(ctx.owner, tenantId, 'temp@vis.local', {
      role: Role.viewer,
      memberScope: 'tribe',
      validTo: future,
    });
    // Log in while the grant is valid (token carries tenantId).
    const token = (await login(ctx.app, 'temp@vis.local', 'vis')).accessToken;

    // Now expire the grant.
    await ctx.owner.roleAssignment.updateMany({
      where: { userId: viewer.id, tenantId },
      data: { validTo: new Date(Date.now() - 60_000) },
    });

    const res = await request(server()).get('/api/v1/persons').set(auth(token));
    expect(res.status).toBe(401);
    expect(res.body.messageKey).toBe('errors.auth.grant_expired');
  });

  it('visibility-settings GET/PATCH round-trip (Tribe Admin)', async () => {
    const patched = await request(server())
      .patch('/api/v1/visibility-settings')
      .set(auth(adminToken))
      .send({ womenDisplay: 'under_father', showPhones: true })
      .expect(200);
    expect(patched.body.womenDisplay).toBe('under_father');
    const got = await request(server())
      .get('/api/v1/visibility-settings')
      .set(auth(adminToken))
      .expect(200);
    expect(got.body.showPhones).toBe(true);
  });

  it('public view-request submission (no auth) creates a pending request', async () => {
    const res = await request(server())
      .post('/api/v1/view-requests')
      .send({
        tenantSlug: 'vis',
        fullName: 'زائر ثلاثي الاسم',
        phone: '0910000000',
        reason: 'قريب يريد المشاهدة',
      })
      .expect(201);
    expect(res.body.status).toBe('pending');

    // Admin can approve with a mandatory expiry, creating a Viewer grant.
    const approved = await request(server())
      .post(`/api/v1/view-requests/${res.body.id}/approve`)
      .set(auth(adminToken))
      .send({ validTo: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .expect(201);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.grantedUserId).toBeTruthy();
    expect(approved.body.validTo).toBeTruthy();
  });

  it('public ID-attachment upload: PNG → key, SVG → 400, oversize → 400', async () => {
    // Minimal valid PNG (8-byte signature + a bit of payload).
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 1),
    ]);
    const ok = await request(server())
      .post('/api/v1/view-requests/id-attachment')
      .field('tenantSlug', 'vis')
      .attach('file', png, 'id.png')
      .expect(201);
    expect(typeof ok.body.idAttachmentKey).toBe('string');
    expect(ok.body.idAttachmentKey).toContain('view-request-ids/vis/');

    // SVG rejected by content sniff even with a .png name.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');
    const svgRes = await request(server())
      .post('/api/v1/view-requests/id-attachment')
      .field('tenantSlug', 'vis')
      .attach('file', svg, 'evil.png');
    expect(svgRes.status).toBe(400);
    expect(svgRes.body.messageKey).toBe('errors.upload.svg_rejected');

    // Oversize (> 10 MB) rejected.
    const big = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(10 * 1024 * 1024 + 1024, 2),
    ]);
    const bigRes = await request(server())
      .post('/api/v1/view-requests/id-attachment')
      .field('tenantSlug', 'vis')
      .attach('file', big, 'big.png');
    expect(bigRes.status).toBe(400);
    expect(bigRes.body.messageKey).toBe('errors.upload.file_too_large');
  }, 30_000);
});

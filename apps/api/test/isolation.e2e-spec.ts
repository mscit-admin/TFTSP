/**
 * MANDATORY cross-tenant isolation test (Spec §4.5). A user from Tenant A hitting
 * every endpoint against Tenant B's resources must get 403/404 and never see
 * Tenant B data. This is the make-or-break test for the RLS design.
 */
import request from 'supertest';
import { Gender } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createTenant, login, seedPerson } from './utils/fixtures';

describe('Cross-tenant isolation (Spec §4.5)', () => {
  let ctx: TestContext;
  let tokenA: string;
  let personB: string;
  let unitB: string;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();

    const tenantA = await createTenant(ctx.owner, 'tenant-a');
    const tenantB = await createTenant(ctx.owner, 'tenant-b');
    await createAdmin(ctx.owner, tenantA.id, 'admin-a@test.local');
    await createAdmin(ctx.owner, tenantB.id, 'admin-b@test.local');

    personB = await seedPerson(ctx.owner, tenantB.id, { firstName: 'خالد' });
    const unit = await ctx.owner.tribalUnit.create({
      data: { tenantId: tenantB.id, unitType: 'clan', nameAr: 'فخذ', nameEn: 'clan' },
    });
    unitB = unit.id;

    ({ accessToken: tokenA } = await login(ctx.app, 'admin-a@test.local', 'tenant-a'));
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  const notVisible = (status: number) => status === 403 || status === 404;

  it('cannot read Tenant B person by id', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/v1/persons/${personB}`)
      .set(auth(tokenA));
    expect(notVisible(res.status)).toBe(true);
  });

  it('cannot update Tenant B person', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`/api/v1/persons/${personB}`)
      .set(auth(tokenA))
      .send({ version: 1, firstName: 'مخترق' });
    expect(notVisible(res.status)).toBe(true);
  });

  it('cannot delete Tenant B person', async () => {
    const res = await request(ctx.app.getHttpServer())
      .delete(`/api/v1/persons/${personB}`)
      .set(auth(tokenA));
    expect(notVisible(res.status)).toBe(true);
  });

  it('cannot read Tenant B tribal unit', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/v1/tribal-units/${unitB}`)
      .set(auth(tokenA));
    expect(notVisible(res.status)).toBe(true);
  });

  it('cannot read Tenant B person via tree root', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/v1/tree?rootId=${personB}&generations=3`)
      .set(auth(tokenA));
    expect(notVisible(res.status)).toBe(true);
  });

  it('cannot read Tenant B ancestors/descendants', async () => {
    const anc = await request(ctx.app.getHttpServer())
      .get(`/api/v1/persons/${personB}/ancestors`)
      .set(auth(tokenA));
    expect(notVisible(anc.status)).toBe(true);
    const desc = await request(ctx.app.getHttpServer())
      .get(`/api/v1/persons/${personB}/descendants`)
      .set(auth(tokenA));
    expect(notVisible(desc.status)).toBe(true);
  });

  it('person list never contains Tenant B rows', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/v1/persons')
      .set(auth(tokenA))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(personB);
  });

  it('tenant settings are scoped to the caller: A patches self, B is untouched', async () => {
    const tenantB = await ctx.owner.tenant.findUniqueOrThrow({ where: { slug: 'tenant-b' } });
    const beforeB = tenantB.nameEn;

    // Admin A can only ever hit their OWN settings (no tenant id in path/body).
    await request(ctx.app.getHttpServer())
      .patch('/api/v1/tenant/settings')
      .set(auth(tokenA))
      .send({ nameEn: 'Renamed By A', primaryColor: '#123456' })
      .expect(200);

    const a = await ctx.owner.tenant.findUniqueOrThrow({ where: { slug: 'tenant-a' } });
    expect(a.nameEn).toBe('Renamed By A');

    const b = await ctx.owner.tenant.findUniqueOrThrow({ where: { slug: 'tenant-b' } });
    expect(b.nameEn).toBe(beforeB); // Tenant B never changed
  });

  it('cannot create a union referencing a Tenant B person', async () => {
    const wifeA = await seedPerson(
      ctx.owner,
      (await ctx.owner.tenant.findUniqueOrThrow({ where: { slug: 'tenant-a' } })).id,
      { gender: Gender.female, firstName: 'فاطمة' },
    );
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/unions')
      .set(auth(tokenA))
      .send({ husbandId: personB, wifeId: wifeA });
    expect(notVisible(res.status)).toBe(true);
  });
});

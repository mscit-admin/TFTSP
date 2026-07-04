/**
 * Lineage integrity + closure-table correctness (Spec §10 M1 acceptance):
 *  - making a grandson the father of his grandfather is rejected (no cycles);
 *  - adding a person under an existing father updates ALL depth rows.
 */
import request from 'supertest';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createTenant, login } from './utils/fixtures';

describe('Lineage integrity & closure (Spec §10)', () => {
  let ctx: TestContext;
  let token: string;
  let tenantId: string;

  const createPerson = async (
    body: Record<string, unknown>,
  ): Promise<{ id: string; version: number }> => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/persons')
      .set(auth(token))
      .send({ confirmDuplicate: true, ...body })
      .expect(201);
    return { id: res.body.id, version: res.body.version };
  };

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'lineage');
    tenantId = tenant.id;
    await createAdmin(ctx.owner, tenant.id, 'admin@lineage.local');
    ({ accessToken: token } = await login(ctx.app, 'admin@lineage.local', 'lineage'));
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('builds closure rows for a 3-generation chain', async () => {
    const grandfather = await createPerson({ firstName: 'الجد', gender: 'male' });
    const father = await createPerson({
      firstName: 'الأب',
      gender: 'male',
      fatherId: grandfather.id,
    });
    const son = await createPerson({ firstName: 'الابن', gender: 'male', fatherId: father.id });

    const rows = await ctx.owner.personClosure.findMany({
      where: { tenantId, descendantId: son.id },
      orderBy: { depth: 'asc' },
    });
    // self(0), father(1), grandfather(2)
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2]);
    expect(rows.find((r) => r.depth === 1)?.ancestorId).toBe(father.id);
    expect(rows.find((r) => r.depth === 2)?.ancestorId).toBe(grandfather.id);

    // descendants endpoint returns father-line descendants of grandfather.
    const desc = await request(ctx.app.getHttpServer())
      .get(`/api/v1/persons/${grandfather.id}/descendants`)
      .set(auth(token))
      .expect(200);
    const descIds = (desc.body as Array<{ id: string }>).map((p) => p.id);
    expect(descIds).toEqual(expect.arrayContaining([father.id, son.id]));
  });

  it('rejects making a grandson the father of his grandfather (no cycle)', async () => {
    const grandfather = await createPerson({ firstName: 'جدنا', gender: 'male' });
    const father = await createPerson({
      firstName: 'أبونا',
      gender: 'male',
      fatherId: grandfather.id,
    });
    const grandson = await createPerson({
      firstName: 'حفيدنا',
      gender: 'male',
      fatherId: father.id,
    });

    const res = await request(ctx.app.getHttpServer())
      .patch(`/api/v1/persons/${grandfather.id}`)
      .set(auth(token))
      .send({ version: grandfather.version, fatherId: grandson.id });

    expect(res.status).toBe(400);
    expect(res.body.messageKey).toBe('errors.person.self_ancestry');
  });

  it('enforces father must be male', async () => {
    const mother = await createPerson({ firstName: 'الأم', gender: 'female' });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/persons')
      .set(auth(token))
      .send({ confirmDuplicate: true, firstName: 'طفل', gender: 'male', fatherId: mother.id });
    expect(res.status).toBe(400);
    expect(res.body.messageKey).toBe('errors.person.father_must_be_male');
  });
});

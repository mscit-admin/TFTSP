/**
 * M2.5 Bulk-Import DoD gates (Spec §12 / contract):
 *  - streaming parse with progress (scaled-down large file);
 *  - in-file `ref:` parent linked on publish;
 *  - >=0.6 row flagged duplicate_candidate;
 *  - all errors shown before insert + partial import of valid rows;
 *  - nothing reaches the live tree before approval (reject leaves DB unchanged);
 *  - rollback soft-deletes + rebuilds closure, refused when later records depend;
 *  - over-plan-limit rejected before processing with available count;
 *  - import logged in Audit.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '@prisma/client';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { auth, createAdmin, createTenant, login, seedPerson } from './utils/fixtures';
import { ImportParseService } from '../src/modules/imports/import-parse.service';

const COLS = [
  'rowRef',
  'fullName',
  'gender',
  'fatherRef',
  'motherRef',
  'birthDate',
  'deathDate',
  'branch',
  'clan',
  'family',
  'spouseRef',
  'laqab',
  'profession',
  'phone',
  'notes',
];

function csv(rows: Array<Record<string, string>>): Buffer {
  const line = (r: Record<string, string>) =>
    COLS.map((c) => {
      const v = r[c] ?? '';
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',');
  return Buffer.from([COLS.join(','), ...rows.map(line)].join('\n'), 'utf8');
}

describe('M2.5 Bulk Import (Spec §12)', () => {
  let ctx: TestContext;
  let tenantId: string;
  let adminToken: string;
  let reviewerToken: string;
  let adminId: string;

  const server = () => ctx.app.getHttpServer();
  const parse = () => ctx.app.get(ImportParseService);

  const uploadCsv = async (buffer: Buffer): Promise<string> => {
    const res = await request(server())
      .post('/api/v1/imports')
      .set(auth(adminToken))
      .attach('file', buffer, 'data.csv')
      .expect(201);
    return res.body.id as string;
  };

  /** Upload → parse (worker is disabled in tests, so run inline). */
  const uploadAndParse = async (rows: Array<Record<string, string>>): Promise<string> => {
    const id = await uploadCsv(csv(rows));
    await parse().run(id);
    return id;
  };

  const approve = async (crId: string) =>
    request(server())
      .post(`/api/v1/change-requests/${crId}/review`)
      .set(auth(reviewerToken))
      .send({ decision: 'approve' })
      .expect(201);

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'imp');
    tenantId = tenant.id;
    const admin = await createAdmin(ctx.owner, tenant.id, 'admin@imp.local', Role.tribe_admin);
    adminId = admin.id;
    await createAdmin(ctx.owner, tenant.id, 'rev@imp.local', Role.deputy_admin);
    adminToken = (await login(ctx.app, 'admin@imp.local', 'imp')).accessToken;
    reviewerToken = (await login(ctx.app, 'rev@imp.local', 'imp')).accessToken;
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  it('streams and parses a scaled-down large file to preview with progress + counts', async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      rowRef: String(i + 1),
      fullName: `شخص رقم ${i + 1}`,
      gender: i % 2 === 0 ? 'male' : 'female',
    }));
    const id = await uploadAndParse(rows);

    const batch = await request(server())
      .get(`/api/v1/imports/${id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(batch.body.status).toBe('preview');
    expect(batch.body.progress).toBe(100);
    expect(batch.body.counts.total).toBe(2000);
    expect(batch.body.counts.valid).toBe(2000);
  }, 120_000);

  it('links an in-file ref parent correctly on publish', async () => {
    const id = await uploadAndParse([
      { rowRef: '1', fullName: 'الجد الأول', gender: 'male' },
      { rowRef: '2', fullName: 'الابن الأول', gender: 'male', fatherRef: 'ref:1' },
    ]);
    const submitted = await request(server())
      .post(`/api/v1/imports/${id}/submit`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    await approve(submitted.body.changeRequestId);

    const father = await ctx.owner.person.findFirstOrThrow({
      where: { tenantId, firstName: 'الجد', importBatchId: id },
    });
    const son = await ctx.owner.person.findFirstOrThrow({
      where: { tenantId, firstName: 'الابن', importBatchId: id },
    });
    expect(son.fatherId).toBe(father.id);
    // closure: father is an ancestor of son
    const closure = await ctx.owner.personClosure.findFirst({
      where: { tenantId, ancestorId: father.id, descendantId: son.id },
    });
    expect(closure?.depth).toBe(1);
  });

  it('flags a >=0.6 similar row as duplicate_candidate', async () => {
    await seedPerson(ctx.owner, tenantId, { firstName: 'عبدالله الفقيه' });
    const id = await uploadAndParse([{ rowRef: '1', fullName: 'عبدالله الفقيه', gender: 'male' }]);
    const rows = await request(server())
      .get(`/api/v1/imports/${id}/rows?status=duplicate_candidate`)
      .set(auth(adminToken))
      .expect(200);
    expect(rows.body.total).toBe(1);
    expect(rows.body.data[0].similarity).toBeGreaterThanOrEqual(0.6);
    expect(rows.body.data[0].duplicateOfId).toBeTruthy();
  });

  it('surfaces all errors before insert and supports partial import of valid rows', async () => {
    const id = await uploadAndParse([
      { rowRef: '1', fullName: 'صالح الطيب', gender: 'male' },
      { rowRef: '2', fullName: '', gender: 'male' }, // missing full name
      { rowRef: '3', fullName: 'نورة الطيب', gender: 'weird' }, // bad gender
    ]);
    const errRows = await request(server())
      .get(`/api/v1/imports/${id}/rows?status=error`)
      .set(auth(adminToken))
      .expect(200);
    expect(errRows.body.total).toBe(2);
    const cols = errRows.body.data.flatMap((r: { errors: Array<{ column: string }> }) =>
      r.errors.map((e) => e.column),
    );
    expect(cols).toEqual(expect.arrayContaining(['fullName', 'gender']));

    // Non-partial submit is refused while error rows exist.
    const refused = await request(server())
      .post(`/api/v1/imports/${id}/submit`)
      .set(auth(adminToken))
      .send({});
    expect(refused.status).toBe(400);
    expect(refused.body.messageKey).toBe('errors.import.has_errors');

    // Partial submit proceeds with the single valid row.
    const submitted = await request(server())
      .post(`/api/v1/imports/${id}/submit`)
      .set(auth(adminToken))
      .send({ partial: true })
      .expect(201);
    await approve(submitted.body.changeRequestId);
    const created = await ctx.owner.person.count({ where: { tenantId, importBatchId: id } });
    expect(created).toBe(1);
  });

  it('applies nothing until approval; a rejected batch leaves the DB unchanged', async () => {
    const before = await ctx.owner.person.count({ where: { tenantId, deletedAt: null } });
    const id = await uploadAndParse([
      { rowRef: '1', fullName: 'مرفوض واحد', gender: 'male' },
      { rowRef: '2', fullName: 'مرفوض اثنان', gender: 'female' },
    ]);
    const submitted = await request(server())
      .post(`/api/v1/imports/${id}/submit`)
      .set(auth(adminToken))
      .send({})
      .expect(201);

    // Not applied yet.
    expect(await ctx.owner.person.count({ where: { tenantId, importBatchId: id } })).toBe(0);

    await request(server())
      .post(`/api/v1/change-requests/${submitted.body.changeRequestId}/review`)
      .set(auth(reviewerToken))
      .send({ decision: 'reject' })
      .expect(201);

    const batch = await request(server())
      .get(`/api/v1/imports/${id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(batch.body.status).toBe('rejected');
    const after = await ctx.owner.person.count({ where: { tenantId, deletedAt: null } });
    expect(after).toBe(before);
  });

  it('rolls back a published batch (soft-delete + closure rebuild) and refuses when depended upon', async () => {
    // Batch A — clean rollback.
    const idA = await uploadAndParse([{ rowRef: '1', fullName: 'قابل للتراجع', gender: 'male' }]);
    const subA = await request(server())
      .post(`/api/v1/imports/${idA}/submit`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    await approve(subA.body.changeRequestId);
    expect(await ctx.owner.person.count({ where: { importBatchId: idA, deletedAt: null } })).toBe(
      1,
    );

    await request(server())
      .post(`/api/v1/imports/${idA}/rollback`)
      .set(auth(adminToken))
      .expect(201);
    expect(await ctx.owner.person.count({ where: { importBatchId: idA, deletedAt: null } })).toBe(
      0,
    );

    // Batch B — a later external child blocks rollback.
    const idB = await uploadAndParse([{ rowRef: '1', fullName: 'أب مستورد', gender: 'male' }]);
    const subB = await request(server())
      .post(`/api/v1/imports/${idB}/submit`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    await approve(subB.body.changeRequestId);
    const importedFather = await ctx.owner.person.findFirstOrThrow({
      where: { importBatchId: idB, deletedAt: null },
    });
    // A child added later (not part of the batch) depends on the imported father.
    await seedPerson(ctx.owner, tenantId, { firstName: 'ابن-لاحق', fatherId: importedFather.id });

    const blocked = await request(server())
      .post(`/api/v1/imports/${idB}/rollback`)
      .set(auth(adminToken));
    expect(blocked.status).toBe(409);
    expect(blocked.body.messageKey).toBe('errors.import.rollback_blocked');
    expect(blocked.body.details.dependentChildren.length).toBeGreaterThan(0);
  });

  it('rejects an over-plan-limit import before processing (subscription tier cap)', async () => {
    // M4 supersedes the M2.5 max_persons stand-in: the cap is the Free tier's 500.
    // Seed the tenant up to 499 so importing 3 more (502) exceeds the cap.
    const current = await ctx.owner.person.count({ where: { tenantId, deletedAt: null } });
    const toSeed = 499 - current;
    if (toSeed > 0) {
      await ctx.owner.person.createMany({
        data: Array.from({ length: toSeed }, (_, i) => ({
          id: randomUUID(),
          tenantId,
          fullName: `cap ${i}`,
          firstName: `cap${i}`,
          gender: 'male' as const,
          createdBy: tenantId,
        })),
      });
    }

    const id = await uploadAndParse([
      { rowRef: '1', fullName: 'زائد واحد', gender: 'male' },
      { rowRef: '2', fullName: 'زائد اثنان', gender: 'male' },
      { rowRef: '3', fullName: 'زائد ثلاثة', gender: 'male' },
    ]);
    const res = await request(server())
      .post(`/api/v1/imports/${id}/submit`)
      .set(auth(adminToken))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.messageKey).toBe('errors.subscription.plan_limit_reached');
    expect(res.body.details).toMatchObject({ tier: 'free', max: 500 });
  }, 60_000);

  it('logs imports in the audit trail', async () => {
    const logs = await ctx.owner.auditLog.findMany({
      where: {
        tenantId,
        userId: adminId,
        action: { in: ['import.upload', 'import.submit', 'import.publish'] },
      },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('serves the bilingual template', async () => {
    const xlsx = await request(server())
      .get('/api/v1/imports/template?format=xlsx&lang=ar')
      .set(auth(adminToken))
      .expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    const csvRes = await request(server())
      .get('/api/v1/imports/template?format=csv&lang=en')
      .set(auth(adminToken))
      .expect(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
  });
});

/**
 * Refresh-token rotation & reuse detection (Spec §10 M1 acceptance):
 * a stolen (already-rotated) refresh token, when replayed, revokes the whole
 * session chain.
 */
import request from 'supertest';
import { bootstrapTestApp, TestContext } from './utils/test-app';
import { createAdmin, createTenant, login, TEST_PASSWORD } from './utils/fixtures';

describe('Auth refresh rotation & reuse (Spec §10)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    const tenant = await createTenant(ctx.owner, 'auth');
    await createAdmin(ctx.owner, tenant.id, 'admin@auth.local');
  }, 180_000);

  afterAll(async () => {
    await ctx.close();
  });

  const refresh = (token: string) =>
    request(ctx.app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: token });

  it('rotates the refresh token and revokes the chain on reuse', async () => {
    const first = await login(ctx.app, 'admin@auth.local', 'auth');

    // Legitimate rotation.
    const rotated = await refresh(first.refreshToken).expect(201);
    const newRefresh = rotated.body.refreshToken as string;
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toEqual(first.refreshToken);

    // Replay the OLD (already-rotated) token => reuse detected.
    const reused = await refresh(first.refreshToken);
    expect(reused.status).toBe(401);
    expect(reused.body.messageKey).toBe('errors.auth.refresh_token_reused');

    // The whole family is revoked: the rotated token no longer works either.
    const afterRevoke = await refresh(newRefresh);
    expect(afterRevoke.status).toBe(401);
  });

  it('locks the account after 5 failed attempts', async () => {
    const tenant = await ctx.owner.tenant.findUniqueOrThrow({ where: { slug: 'auth' } });
    await createAdmin(ctx.owner, tenant.id, 'lockme@auth.local');
    const server = ctx.app.getHttpServer();
    for (let i = 0; i < 5; i += 1) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'lockme@auth.local', password: 'wrong-password-123' })
        .expect(401);
    }
    // Correct password now, but the account is locked.
    const locked = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'lockme@auth.local', password: TEST_PASSWORD });
    expect(locked.status).toBe(401);
    expect(locked.body.messageKey).toBe('errors.auth.account_locked');
  });
});

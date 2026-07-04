import { Gender, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const TEST_PASSWORD = 'CorrectHorseBattery1';

export async function createTenant(owner: PrismaClient, slug: string) {
  return owner.tenant.create({
    data: { slug, nameAr: slug, nameEn: slug },
  });
}

export async function createAdmin(
  owner: PrismaClient,
  tenantId: string,
  email: string,
  role: Role = Role.tribe_admin,
) {
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  const user = await owner.user.create({
    data: { email: email.toLowerCase(), fullName: email, passwordHash },
  });
  await owner.roleAssignment.create({
    data: { tenantId, userId: user.id, role, tribalUnitId: null },
  });
  return user;
}

export async function createSuperAdmin(owner: PrismaClient, email: string) {
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  return owner.user.create({
    data: { email: email.toLowerCase(), fullName: email, passwordHash, isSuperAdmin: true },
  });
}

/** Insert a person directly (owner client, bypasses RLS) with a self closure row. */
export async function seedPerson(
  owner: PrismaClient,
  tenantId: string,
  overrides: Partial<{ firstName: string; gender: Gender; fatherId: string | null }> = {},
) {
  const id = randomUUID();
  const firstName = overrides.firstName ?? 'محمد';
  await owner.person.create({
    data: {
      id,
      tenantId,
      fullName: firstName,
      firstName,
      gender: overrides.gender ?? Gender.male,
      fatherId: overrides.fatherId ?? null,
      createdBy: tenantId,
    },
  });
  await owner.personClosure.create({
    data: { tenantId, ancestorId: id, descendantId: id, depth: 0 },
  });
  return id;
}

export interface LoggedIn {
  accessToken: string;
  refreshToken: string;
}

export async function login(
  app: INestApplication,
  email: string,
  tenantSlug?: string,
): Promise<LoggedIn> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD, tenantSlug })
    .expect(201);
  return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

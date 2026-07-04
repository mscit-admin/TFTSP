/* eslint-disable no-console */
/**
 * Seed script (Spec §11.5): 2 tribes, ~200 persons across 3 generations each,
 * and users covering every role — for manual isolation/visibility testing.
 *
 * Runs as the OWNER role (DATABASE_MIGRATION_URL) so it can write across tenants
 * and populate the closure table directly. Never used at request time.
 */
import { PrismaClient, Gender, Role, UnitType } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL },
  },
});

const SEED_PASSWORD = 'ChangeMe!2026_seed';

interface SeededPerson {
  id: string;
  fatherId: string | null;
}

const MALE_NAMES = ['محمد', 'أحمد', 'علي', 'حسن', 'خالد', 'عمر', 'يوسف', 'إبراهيم', 'سالم', 'ناصر'];
const FEMALE_NAMES = ['فاطمة', 'عائشة', 'مريم', 'زينب', 'خديجة', 'سارة', 'هند', 'نورة'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function seedTenant(
  index: number,
  slug: string,
  nameAr: string,
  nameEn: string,
): Promise<void> {
  console.log(`Seeding tenant ${slug}...`);
  const tenant = await prisma.tenant.create({
    data: { slug, nameAr, nameEn, primaryColor: index === 0 ? '#0b7d3e' : '#1d4ed8' },
  });

  // Tribal hierarchy: tribe -> branch -> clan -> family
  const tribe = await prisma.tribalUnit.create({
    data: { tenantId: tenant.id, unitType: UnitType.tribe, nameAr, nameEn },
  });
  const branch = await prisma.tribalUnit.create({
    data: {
      tenantId: tenant.id,
      parentId: tribe.id,
      unitType: UnitType.branch,
      nameAr: `فرع ${nameAr}`,
      nameEn: `${nameEn} Branch`,
    },
  });
  const clan = await prisma.tribalUnit.create({
    data: {
      tenantId: tenant.id,
      parentId: branch.id,
      unitType: UnitType.clan,
      nameAr: `فخذ ${nameAr}`,
      nameEn: `${nameEn} Clan`,
    },
  });
  const family = await prisma.tribalUnit.create({
    data: {
      tenantId: tenant.id,
      parentId: clan.id,
      unitType: UnitType.family,
      nameAr: `عائلة ${nameAr}`,
      nameEn: `${nameEn} Family`,
    },
  });

  // Users covering every tenant-level role.
  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });
  const roles: Role[] = [
    Role.tribe_admin,
    Role.deputy_admin,
    Role.branch_admin,
    Role.reviewer,
    Role.contributor,
    Role.viewer,
    Role.guest,
  ];
  for (const role of roles) {
    const user = await prisma.user.create({
      data: {
        email: `${role}.${slug}@tftsp.local`,
        fullName: `${role} ${nameEn}`,
        passwordHash,
      },
    });
    await prisma.roleAssignment.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role,
        tribalUnitId: role === Role.branch_admin ? branch.id : null,
      },
    });
  }

  // Persons: 3 generations. gen1 roots -> gen2 -> gen3, ~200 total.
  const people: SeededPerson[] = [];
  const unitIds = [tribe.id, branch.id, clan.id, family.id];
  let counter = 0;

  const createPerson = async (
    fatherId: string | null,
    gender: Gender,
    gen: number,
  ): Promise<SeededPerson> => {
    const first =
      gender === Gender.male ? pick(MALE_NAMES, counter) : pick(FEMALE_NAMES, counter);
    const fullName = `${first} ${pick(MALE_NAMES, counter + 1)} ${nameAr}`;
    const id = randomUUID();
    await prisma.person.create({
      data: {
        id,
        tenantId: tenant.id,
        fullName,
        firstName: first,
        fatherName: pick(MALE_NAMES, counter + 1),
        familyName: nameAr,
        gender,
        isDeceased: gen === 1,
        fatherId,
        tribalUnitId: pick(unitIds, gen),
        createdBy: tenant.id,
      },
    });
    counter += 1;
    const person = { id, fatherId };
    people.push(person);
    return person;
  };

  const gen1: SeededPerson[] = [];
  for (let r = 0; r < 4; r += 1) {
    gen1.push(await createPerson(null, Gender.male, 1));
  }
  const gen2: SeededPerson[] = [];
  for (const root of gen1) {
    for (let c = 0; c < 6; c += 1) {
      const gender = c % 3 === 0 ? Gender.female : Gender.male;
      gen2.push(await createPerson(root.id, gender, 2));
    }
  }
  for (const parent of gen2) {
    for (let c = 0; c < 7; c += 1) {
      const gender = c % 4 === 0 ? Gender.female : Gender.male;
      await createPerson(parent.id, gender, 3);
    }
  }

  // Closure table (paternal) — self row + every ancestor up the father chain.
  const fatherById = new Map(people.map((p) => [p.id, p.fatherId]));
  const closureRows: Array<{
    tenantId: string;
    ancestorId: string;
    descendantId: string;
    depth: number;
  }> = [];
  for (const person of people) {
    closureRows.push({
      tenantId: tenant.id,
      ancestorId: person.id,
      descendantId: person.id,
      depth: 0,
    });
    let ancestor = fatherById.get(person.id) ?? null;
    let depth = 1;
    while (ancestor) {
      closureRows.push({
        tenantId: tenant.id,
        ancestorId: ancestor,
        descendantId: person.id,
        depth,
      });
      ancestor = fatherById.get(ancestor) ?? null;
      depth += 1;
    }
  }
  await prisma.personClosure.createMany({ data: closureRows });

  console.log(`  -> ${people.length} persons, ${closureRows.length} closure rows.`);
}

async function main(): Promise<void> {
  // Platform Super Admin.
  const superHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email: 'superadmin@tftsp.local' },
    update: {},
    create: {
      email: 'superadmin@tftsp.local',
      fullName: 'Platform Super Admin',
      passwordHash: superHash,
      isSuperAdmin: true,
    },
  });

  await seedTenant(0, 'bani-hilal', 'بنو هلال', 'Bani Hilal');
  await seedTenant(1, 'bani-tamim', 'بنو تميم', 'Bani Tamim');

  console.log('Seed complete. Login password for all seeded users:', SEED_PASSWORD);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

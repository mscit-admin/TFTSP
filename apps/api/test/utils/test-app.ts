/**
 * Boots a real PostgreSQL 16 (Testcontainers), applies the Prisma migrations
 * (init + custom RLS/search), and starts the Nest app wired exactly like prod —
 * app traffic uses the `tftsp_app` role (NO BYPASSRLS). Requires Docker.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter';
import { MinioService } from '../../src/common/minio/minio.service';
import { InMemoryMinio } from './in-memory-minio';

export interface TestContext {
  app: INestApplication;
  /** Superuser/owner client — bypasses RLS, for test data setup across tenants. */
  owner: PrismaClient;
  container: StartedPostgreSqlContainer;
  close: () => Promise<void>;
}

export async function bootstrapTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('tftsp')
    .withUsername('tftsp')
    .withPassword('tftsp_dev_pw')
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const ownerUrl = `postgresql://tftsp:tftsp_dev_pw@${host}:${port}/tftsp?schema=public`;
  const appUrl = `postgresql://tftsp_app:tftsp_app_pw@${host}:${port}/tftsp?schema=public`;

  // Apply migrations as the owner (creates tftsp_app, RLS, generated column).
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: ownerUrl },
    stdio: 'inherit',
  });

  process.env.DATABASE_URL = appUrl;
  process.env.DATABASE_MIGRATION_URL = ownerUrl;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';
  // No Redis in tests — the BullMQ scheduler is skipped; the maintenance service
  // (which the M2 e2e drives directly) is always available.
  process.env.ENABLE_SCHEDULER = 'false';
  process.env.SMTP_HOST = process.env.SMTP_HOST ?? '127.0.0.1';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // Import (M2.5) uses object storage; swap in an in-memory MinIO for e2e.
    .overrideProvider(MinioService)
    .useClass(InMemoryMinio)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  await owner.$connect();

  return {
    app,
    owner,
    container,
    close: async () => {
      await owner.$disconnect();
      await app.close();
      await container.stop();
    },
  };
}

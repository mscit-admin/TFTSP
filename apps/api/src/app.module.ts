import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfiguration } from './common/config/configuration';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { LineageModule } from './modules/lineage/lineage.module';
import { PersonsModule } from './modules/persons/persons.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TenantSettingsModule } from './modules/tenant-settings/tenant-settings.module';
import { TribalUnitsModule } from './modules/tribal-units/tribal-units.module';
import { UnionsModule } from './modules/unions/unions.module';
// M2
import { ChangeRequestsModule } from './modules/change-requests/change-requests.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkflowSettingsModule } from './modules/workflow-settings/workflow-settings.module';
import { ChangeRequestMaintenanceModule } from './modules/jobs/change-request-maintenance.module';
import { JobsModule } from './modules/jobs/jobs.module';
// M2.5
import { MinioModule } from './common/minio/minio.module';
import { ImportsModule } from './modules/imports/imports.module';

// BullMQ scheduler needs Redis; disable in tests/CI-without-redis via ENABLE_SCHEDULER=false.
const schedulerEnabled = process.env.ENABLE_SCHEDULER !== 'false';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfiguration], cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req, res) => {
          const existing = (req.headers['x-request-id'] as string) ?? randomUUID();
          res.setHeader('x-request-id', existing);
          return existing;
        },
        // Structured JSON with tenant_id + request_id per line (Spec §9).
        customProps: (req) => {
          const user = (req as { user?: { tenantId?: string } }).user;
          return { tenant_id: user?.tenantId ?? null };
        },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: process.env.DEFAULT_LOCALE ?? 'ar',
      loaderOptions: { path: join(__dirname, '/i18n/'), watch: true },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    PlatformModule,
    TenantSettingsModule,
    TribalUnitsModule,
    PersonsModule,
    UnionsModule,
    LineageModule,
    // M2
    WorkflowSettingsModule,
    NotificationsModule,
    ChangeRequestsModule,
    ChangeRequestMaintenanceModule,
    // M2.5
    MinioModule,
    ImportsModule,
    ...(schedulerEnabled ? [JobsModule] : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}

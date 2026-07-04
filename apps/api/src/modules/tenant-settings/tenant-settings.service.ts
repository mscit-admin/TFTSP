import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AuditService } from '../audit/audit.service';
import {
  LogoUploadResponseDto,
  TenantSettingsResponseDto,
  UpdateTenantSettingsDto,
} from './dto/tenant-settings.dto';
import { TenantSettingsRepository } from './tenant-settings.repository';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly repo: TenantSettingsRepository,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContext,
    private readonly config: ConfigService,
  ) {}

  async get(): Promise<TenantSettingsResponseDto> {
    const tenant = await this.load();
    return this.toResponse(tenant);
  }

  async update(dto: UpdateTenantSettingsDto): Promise<TenantSettingsResponseDto> {
    const before = await this.load();

    const updated = await this.repo.updateScoped(before.id, {
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
      ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
      ...(dto.logoKey !== undefined ? { logoKey: dto.logoKey } : {}),
    });

    await this.audit.record({
      action: 'tenant.settings.update',
      entityType: 'Tenant',
      entityId: before.id,
      before: this.toResponse(before),
      after: this.toResponse(updated),
    });

    return this.toResponse(updated);
  }

  /**
   * Presigned PUT for the tribe logo (MinIO, 15-min TTL). MinIO client wiring is
   * an M4 concern (Spec §3/M4); in M1 this returns the agreed shape with a
   * best-effort URL so admin-web can integrate. See DECISIONS D-108.
   */
  async logoUploadUrl(): Promise<LogoUploadResponseDto> {
    const tenantId = this.tenantContext.requireTenantId();
    const logoKey = `tenants/${tenantId}/logo-${randomUUID()}`;

    const endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = this.config.get<string>('MINIO_PORT') ?? '9000';
    const bucket = this.config.get<string>('MINIO_BUCKET') ?? 'tftsp';
    const useSsl = (this.config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true';
    const scheme = useSsl ? 'https' : 'http';
    const expiresInSeconds = 900; // 15 minutes

    // NOTE: not a cryptographically signed URL yet — placeholder query marks the
    // intended TTL. Replace with a real MinIO presign in M4 without changing shape.
    const uploadUrl =
      `${scheme}://${endpoint}:${port}/${bucket}/${logoKey}` +
      `?X-Amz-Expires=${expiresInSeconds}&X-Amz-Stub=1`;

    return { uploadUrl, logoKey };
  }

  // -------------------------------------------------------------------------

  private async load(): Promise<Tenant> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.repo.findById(tenantId);
    if (!tenant) {
      throw AppException.notFound(ErrorKeys.TENANT_NOT_FOUND, { id: tenantId });
    }
    return tenant;
  }

  private toResponse(tenant: Tenant): TenantSettingsResponseDto {
    return {
      nameAr: tenant.nameAr,
      nameEn: tenant.nameEn,
      slug: tenant.slug,
      logoKey: tenant.logoKey,
      primaryColor: tenant.primaryColor,
    };
  }
}

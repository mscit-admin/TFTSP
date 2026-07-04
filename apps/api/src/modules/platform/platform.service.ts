import { Injectable } from '@nestjs/common';
import { Tenant, TenantStatus } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { PasswordService } from '../auth/password.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PlatformRepository } from './platform.repository';

export interface TenantListItem {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  status: TenantStatus;
  logoKey: string | null;
  primaryColor: string | null;
  createdAt: Date;
  personCount: number;
  userCount: number;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly repo: PlatformRepository,
    private readonly passwords: PasswordService,
  ) {}

  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    const existingSlug = await this.repo.findTenantBySlug(dto.slug);
    if (existingSlug) {
      throw AppException.conflict(ErrorKeys.TENANT_SLUG_TAKEN, { slug: dto.slug });
    }

    this.passwords.assertPolicy(dto.admin.password);

    const emailExists = await this.repo.userEmailExists(dto.admin.email);
    if (emailExists) {
      throw AppException.conflict(ErrorKeys.EMAIL_TAKEN, { email: dto.admin.email });
    }

    const passwordHash = await this.passwords.hash(dto.admin.password);
    return this.repo.createTenantWithAdmin(
      { slug: dto.slug, nameAr: dto.nameAr, nameEn: dto.nameEn },
      { email: dto.admin.email, fullName: dto.admin.fullName, passwordHash },
    );
  }

  async listTenants(): Promise<TenantListItem[]> {
    const [tenants, personCounts, userCounts] = await Promise.all([
      this.repo.listTenants(),
      this.repo.personCountsByTenant(),
      this.repo.userCountsByTenant(),
    ]);
    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      nameAr: t.nameAr,
      nameEn: t.nameEn,
      status: t.status,
      logoKey: t.logoKey,
      primaryColor: t.primaryColor,
      createdAt: t.createdAt,
      personCount: personCounts.get(t.id) ?? 0,
      userCount: userCounts.get(t.id) ?? 0,
    }));
  }

  async suspend(id: string): Promise<Tenant> {
    await this.assertTenantExists(id);
    return this.repo.setTenantStatus(id, TenantStatus.suspended);
  }

  async activate(id: string): Promise<Tenant> {
    await this.assertTenantExists(id);
    return this.repo.setTenantStatus(id, TenantStatus.active);
  }

  stats(): Promise<{ tribes: number; persons: number; users: number }> {
    return this.repo.globalStats();
  }

  private async assertTenantExists(id: string): Promise<void> {
    const tenant = await this.repo.findTenantById(id);
    if (!tenant) {
      throw AppException.notFound(ErrorKeys.TENANT_NOT_FOUND, { id });
    }
  }
}

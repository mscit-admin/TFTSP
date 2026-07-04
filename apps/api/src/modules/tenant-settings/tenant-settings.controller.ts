import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import {
  LogoUploadResponseDto,
  TenantSettingsResponseDto,
  UpdateTenantSettingsDto,
} from './dto/tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

/**
 * Current tribe's settings (admin-web tribe-settings page). Tenant-scoped by the
 * JWT's tenantId ONLY — there is no tenant id in the path or body, so a Tribe
 * Admin can never target another tribe's settings.
 */
@ApiTags('tenant-settings')
@ApiBearerAuth()
@Controller('tenant/settings')
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get()
  @RequirePermission('tenant.read')
  @ApiOperation({ summary: "Current tenant's settings (name, slug, logo, colour)." })
  @ApiOkResponse({ type: TenantSettingsResponseDto })
  get(): Promise<TenantSettingsResponseDto> {
    return this.service.get();
  }

  @Patch()
  @RequirePermission('tenant.update')
  @ApiOperation({ summary: "Update the current tenant's settings (Tribe Admin)." })
  @ApiOkResponse({ type: TenantSettingsResponseDto })
  update(@Body() dto: UpdateTenantSettingsDto): Promise<TenantSettingsResponseDto> {
    return this.service.update(dto);
  }

  @Post('logo-upload')
  @RequirePermission('tenant.update')
  @ApiOperation({ summary: 'Presigned MinIO PUT for the tribe logo (15-min TTL).' })
  @ApiOkResponse({ type: LogoUploadResponseDto })
  logoUpload(): Promise<LogoUploadResponseDto> {
    return this.service.logoUploadUrl();
  }
}

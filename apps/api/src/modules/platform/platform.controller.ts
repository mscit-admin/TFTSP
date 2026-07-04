import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminOnly } from '../../common/decorators/super-admin.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PlatformService } from './platform.service';

/** Platform administration (Spec §4.4) — NOT tenant-scoped, Super Admin only. */
@ApiTags('platform')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  @ApiOperation({ summary: 'List tribes with person/user counts.' })
  listTenants() {
    return this.platform.listTenants();
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Create a tribe and its first Tribe Admin.' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.platform.createTenant(dto);
  }

  @Post('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a tribe.' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.suspend(id);
  }

  @Post('tenants/:id/activate')
  @ApiOperation({ summary: 'Reactivate a suspended tribe.' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.activate(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global counts: tribes, persons, users.' })
  stats() {
    return this.platform.stats();
  }
}

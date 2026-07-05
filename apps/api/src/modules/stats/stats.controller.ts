import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminOnly } from '../../common/decorators/super-admin.decorator';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('tribe')
  @RequirePermission('stats.read')
  @ApiOperation({ summary: 'Tribe dashboard (materialized-view backed).' })
  tribe() {
    return this.service.tribeStats();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('stats.read')
  @ApiOperation({ summary: 'On-demand refresh of the stats materialized views.' })
  async refresh() {
    await this.service.refresh();
    return { refreshed: true };
  }
}

/** Platform dashboard — Super Admin only, NOT tenant-scoped. */
@ApiTags('platform-stats')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('platform/stats')
export class PlatformStatsController {
  constructor(private readonly service: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform-wide dashboard (Super Admin).' })
  dashboard() {
    return this.service.platformDashboard();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh the stats materialized views.' })
  async refresh() {
    await this.service.refresh();
    return { refreshed: true };
  }
}

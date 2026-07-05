import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuperAdminOnly } from '../../common/decorators/super-admin.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { SubscriptionService } from './subscription.service';
import { SetSubscriptionDto } from './dto/subscription.dto';

/** Platform (Super Admin) subscription management — NOT tenant-scoped (Spec §M4.8). */
@ApiTags('platform-subscriptions')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('platform/tenants/:tenantId/subscription')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Current subscription (tier, status, cap, current count).' })
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.get(tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Assign a plan + manually activate (bank transfer).' })
  set(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.set(tenantId, dto, user.id);
  }

  @Get('activations')
  @ApiOperation({ summary: 'Activation log for this tenant.' })
  activations(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.service.activations(tenantId);
  }
}

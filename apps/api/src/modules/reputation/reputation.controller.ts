import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ReputationService } from './reputation.service';
import { UpdateReputationThresholdsDto } from './dto/reputation.dto';

@ApiTags('reputation')
@ApiBearerAuth()
@Controller('reputation')
export class ReputationController {
  constructor(private readonly service: ReputationService) {}

  @Get('me')
  @RequirePermission('reputation.read')
  @ApiOperation({ summary: "Current user's reputation in the active tenant." })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.service.me(user.id);
  }

  @Get()
  @RequirePermission('reputation.manage')
  @ApiOperation({ summary: 'Contributors ranked by accuracy (Tribe Admin).' })
  list() {
    return this.service.listRanked();
  }

  @Get('thresholds')
  @RequirePermission('reputation.manage')
  @ApiOperation({ summary: 'Reputation thresholds + contribution policy.' })
  getThresholds() {
    return this.service.getThresholds();
  }

  @Patch('thresholds')
  @RequirePermission('reputation.manage')
  @ApiOperation({ summary: 'Update thresholds / allowViewerContributions / maxPending (audited).' })
  updateThresholds(@Body() dto: UpdateReputationThresholdsDto) {
    return this.service.updateThresholds(dto);
  }
}

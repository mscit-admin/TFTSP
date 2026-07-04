import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import {
  UpdateVisibilitySettingsDto,
  VisibilitySettingsResponseDto,
} from './dto/visibility-settings.dto';
import { VisibilitySettingsService } from './visibility-settings.service';

@ApiTags('visibility-settings')
@ApiBearerAuth()
@Controller('visibility-settings')
export class VisibilitySettingsController {
  constructor(private readonly service: VisibilitySettingsService) {}

  @Get()
  @RequirePermission('visibilitySettings.read')
  @ApiOperation({ summary: 'Current tenant visibility level + field policies.' })
  @ApiOkResponse({ type: VisibilitySettingsResponseDto })
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission('visibilitySettings.update')
  @ApiOperation({ summary: 'Update visibility level / women-display / field policies (audited).' })
  @ApiOkResponse({ type: VisibilitySettingsResponseDto })
  update(@Body() dto: UpdateVisibilitySettingsDto) {
    return this.service.update(dto);
  }
}

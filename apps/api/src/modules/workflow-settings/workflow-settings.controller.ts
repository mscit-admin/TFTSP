import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import {
  UpdateWorkflowSettingsDto,
  WorkflowSettingsResponseDto,
} from './dto/workflow-settings.dto';
import { WorkflowSettingsService } from './workflow-settings.service';

@ApiTags('workflow-settings')
@ApiBearerAuth()
@Controller('workflow-settings')
export class WorkflowSettingsController {
  constructor(private readonly service: WorkflowSettingsService) {}

  @Get()
  @RequirePermission('workflowSettings.read')
  @ApiOperation({ summary: 'Current tenant approval-workflow settings.' })
  @ApiOkResponse({ type: WorkflowSettingsResponseDto })
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission('workflowSettings.update')
  @ApiOperation({
    summary: 'Update approvals-required / expiry-days / reviewer-can-edit (audited).',
  })
  @ApiOkResponse({ type: WorkflowSettingsResponseDto })
  update(@Body() dto: UpdateWorkflowSettingsDto) {
    return this.service.update(dto);
  }
}

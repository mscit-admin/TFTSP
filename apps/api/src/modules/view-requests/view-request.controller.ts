import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ViewRequestService } from './view-request.service';
import {
  ApproveViewRequestDto,
  CreateViewRequestDto,
  ListViewRequestsDto,
} from './dto/view-request.dto';

@ApiTags('view-requests')
@Controller('view-requests')
export class ViewRequestController {
  constructor(private readonly service: ViewRequestService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'PUBLIC — submit a non-member tree-view request (tenant via slug).' })
  create(@Body() dto: CreateViewRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermission('viewRequest.manage')
  @ApiOperation({ summary: 'List view requests (filter ?status=).' })
  list(@Query() dto: ListViewRequestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(dto, user);
  }

  @Post(':id/approve')
  @ApiBearerAuth()
  @RequirePermission('viewRequest.manage')
  @ApiOperation({ summary: 'Approve → create a Viewer grant with a mandatory expiry (validTo).' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveViewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, dto, user);
  }

  @Post(':id/reject')
  @ApiBearerAuth()
  @RequirePermission('viewRequest.manage')
  @ApiOperation({ summary: 'Reject a view request.' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reject(id, user);
  }
}

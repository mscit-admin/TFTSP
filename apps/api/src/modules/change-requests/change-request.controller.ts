import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import {
  CreateChangeRequestDto,
  ListChangeRequestsDto,
  ReviewChangeRequestDto,
  UpdateChangeRequestDto,
} from './dto/change-request.dto';
import { ChangeRequestService } from './change-request.service';

@ApiTags('change-requests')
@ApiBearerAuth()
@Controller('change-requests')
export class ChangeRequestController {
  constructor(private readonly service: ChangeRequestService) {}

  @Post()
  @RequirePermission('changeRequest.create')
  @ApiOperation({ summary: 'Create a draft change request (captures baseVersion).' })
  create(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @RequirePermission('changeRequest.read')
  @ApiOperation({ summary: 'List change requests; filters ?status=&mine=true&queue=true.' })
  list(@Query() dto: ListChangeRequestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(dto, user);
  }

  @Get(':id')
  @RequirePermission('changeRequest.read')
  @ApiOperation({ summary: 'Full change request including reviews[].' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('changeRequest.create')
  @ApiOperation({ summary: 'Edit patch while draft/changes_requested (or reviewer if allowed).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/submit')
  @RequirePermission('changeRequest.create')
  @ApiOperation({ summary: 'Submit (draft/changes_requested → submitted); notifies reviewers.' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/review')
  @RequirePermission('changeRequest.review')
  @ApiOperation({ summary: 'Review: approve|reject|request_changes. Auto-publishes at quorum.' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.review(id, dto, user);
  }
}

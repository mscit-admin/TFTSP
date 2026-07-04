import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @RequirePermission('notification.read')
  @ApiOperation({ summary: 'My notifications (paginated) + unread count.' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() dto: ListNotificationsDto) {
    return this.service.list(user.id, dto);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('notification.read')
  @ApiOperation({ summary: 'Mark one of my notifications read.' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('notification.read')
  @ApiOperation({ summary: 'Mark all my notifications read.' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user.id);
  }
}

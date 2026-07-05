import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(private readonly service: DeviceService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('device.manage')
  @ApiOperation({ summary: 'Register/refresh my device FCM token (upsert by token).' })
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.service.register(user.id, dto);
  }

  @Delete(':token')
  @RequirePermission('device.manage')
  @ApiOperation({ summary: 'Deregister my device (on logout). Idempotent.' })
  deregister(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string) {
    // Tokens are URL-encoded by the client (they may contain ':' / '-' / '_').
    return this.service.deregister(user.id, decodeURIComponent(token));
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ViewRequestController } from './view-request.controller';
import { ViewRequestRepository } from './view-request.repository';
import { ViewRequestService } from './view-request.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ViewRequestController],
  providers: [ViewRequestService, ViewRequestRepository],
})
export class ViewRequestsModule {}

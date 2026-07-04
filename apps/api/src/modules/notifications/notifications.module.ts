import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { EmailNotificationChannel } from './channels/email.channel';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { NotificationChannel } from './channels/notification-channel';
import { NOTIFICATION_CHANNELS } from './notification.constants';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationGateway,
    InAppNotificationChannel,
    EmailNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (inApp: InAppNotificationChannel, email: EmailNotificationChannel) =>
        [inApp, email] as NotificationChannel[],
      inject: [InAppNotificationChannel, EmailNotificationChannel],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}

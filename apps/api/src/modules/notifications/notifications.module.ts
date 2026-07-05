import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { EmailNotificationChannel } from './channels/email.channel';
import { FcmNotificationChannel } from './channels/fcm.channel';
import { FcmService } from './channels/fcm.service';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { NotificationChannel } from './channels/notification-channel';
import { NOTIFICATION_CHANNELS } from './notification.constants';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

@Module({
  imports: [AuthModule, JwtModule.register({}), DevicesModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationGateway,
    InAppNotificationChannel,
    EmailNotificationChannel,
    FcmService,
    FcmNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (
        inApp: InAppNotificationChannel,
        email: EmailNotificationChannel,
        fcm: FcmNotificationChannel,
      ) => [inApp, email, fcm] as NotificationChannel[],
      inject: [InAppNotificationChannel, EmailNotificationChannel, FcmNotificationChannel],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}

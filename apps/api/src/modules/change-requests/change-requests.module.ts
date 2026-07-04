import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonsModule } from '../persons/persons.module';
import { TribalUnitsModule } from '../tribal-units/tribal-units.module';
import { UnionsModule } from '../unions/unions.module';
import { WorkflowSettingsModule } from '../workflow-settings/workflow-settings.module';
import { ChangeRequestController } from './change-request.controller';
import { ChangeRequestPublisher } from './change-request.publisher';
import { ChangeRequestRepository } from './change-request.repository';
import { ChangeRequestService } from './change-request.service';

@Module({
  imports: [
    PersonsModule,
    UnionsModule,
    TribalUnitsModule,
    WorkflowSettingsModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [ChangeRequestController],
  providers: [ChangeRequestService, ChangeRequestRepository, ChangeRequestPublisher],
  exports: [ChangeRequestService, ChangeRequestRepository],
})
export class ChangeRequestsModule {}

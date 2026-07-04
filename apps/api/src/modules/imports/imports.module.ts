import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { ChangeRequestsModule } from '../change-requests/change-requests.module';
import { LineageModule } from '../lineage/lineage.module';
import { PersonsModule } from '../persons/persons.module';
import { ImportApplyService } from './import-apply.service';
import { ImportController } from './import.controller';
import { ImportDispatcher } from './import.dispatcher';
import { ImportGateway } from './import.gateway';
import { ImportParseService } from './import-parse.service';
import { ImportProgressService } from './import-progress.service';
import { ImportRepository } from './import.repository';
import { ImportService } from './import.service';
import { ImportTemplateService } from './import-template.service';
import { IMPORT_BATCH_APPLIER } from './import.constants';

@Module({
  imports: [
    PersonsModule,
    LineageModule,
    AuditModule,
    JwtModule.register({}),
    forwardRef(() => ChangeRequestsModule),
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    ImportRepository,
    ImportParseService,
    ImportApplyService,
    ImportProgressService,
    ImportGateway,
    ImportTemplateService,
    ImportDispatcher,
    // The M2 change-request service delegates import-batch publish to this.
    { provide: IMPORT_BATCH_APPLIER, useExisting: ImportApplyService },
  ],
  exports: [ImportParseService, ImportApplyService, ImportDispatcher, IMPORT_BATCH_APPLIER],
})
export class ImportsModule {}

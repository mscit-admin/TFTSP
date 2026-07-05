import { Module } from '@nestjs/common';
import { PersonsModule } from '../persons/persons.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

@Module({
  imports: [PersonsModule],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentRepository],
})
export class DocumentsModule {}

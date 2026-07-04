import { Module } from '@nestjs/common';
import { LineageModule } from '../lineage/lineage.module';
import { PersonsController } from './persons.controller';
import { PersonsRepository } from './persons.repository';
import { PersonsService } from './persons.service';

@Module({
  imports: [LineageModule],
  controllers: [PersonsController],
  providers: [PersonsService, PersonsRepository],
  exports: [PersonsService],
})
export class PersonsModule {}

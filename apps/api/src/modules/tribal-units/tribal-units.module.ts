import { Module } from '@nestjs/common';
import { TribalUnitsController } from './tribal-units.controller';
import { TribalUnitsRepository } from './tribal-units.repository';
import { TribalUnitsService } from './tribal-units.service';

@Module({
  controllers: [TribalUnitsController],
  providers: [TribalUnitsService, TribalUnitsRepository],
  exports: [TribalUnitsService, TribalUnitsRepository],
})
export class TribalUnitsModule {}

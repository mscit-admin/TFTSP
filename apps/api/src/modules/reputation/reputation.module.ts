import { Module } from '@nestjs/common';
import { ReputationController } from './reputation.controller';
import { ReputationRepository } from './reputation.repository';
import { ReputationService } from './reputation.service';

@Module({
  controllers: [ReputationController],
  providers: [ReputationService, ReputationRepository],
  exports: [ReputationService, ReputationRepository],
})
export class ReputationModule {}

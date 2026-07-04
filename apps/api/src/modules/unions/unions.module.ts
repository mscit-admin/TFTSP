import { Module } from '@nestjs/common';
import { UnionsController } from './unions.controller';
import { UnionsRepository } from './unions.repository';
import { UnionsService } from './unions.service';

@Module({
  controllers: [UnionsController],
  providers: [UnionsService, UnionsRepository],
  exports: [UnionsService, UnionsRepository],
})
export class UnionsModule {}

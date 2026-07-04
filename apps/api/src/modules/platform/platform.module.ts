import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformController } from './platform.controller';
import { PlatformRepository } from './platform.repository';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRepository],
})
export class PlatformModule {}

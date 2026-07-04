import { Global, Module } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, TenantContext],
  exports: [PrismaService, TenantContext],
})
export class PrismaModule {}

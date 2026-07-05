import { Module } from '@nestjs/common';
import { PlatformStatsController, StatsController } from './stats.controller';
import { StatsRefreshService } from './stats-refresh.service';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController, PlatformStatsController],
  providers: [StatsService, StatsRepository, StatsRefreshService],
  exports: [StatsService, StatsRefreshService],
})
export class StatsModule {}

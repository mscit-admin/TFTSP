import { Module } from '@nestjs/common';
import { LineageModule } from '../lineage/lineage.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PdfRenderer } from './pdf-renderer';

@Module({
  imports: [LineageModule],
  controllers: [ExportController],
  providers: [ExportService, PdfRenderer],
})
export class ExportsModule {}

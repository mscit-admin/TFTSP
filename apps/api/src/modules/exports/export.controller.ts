import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ExportService } from './export.service';
import { ExportTreePdfDto, ExportTreePngDto } from './dto/export.dto';

@ApiTags('exports')
@ApiBearerAuth()
@Controller('exports')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Post('tree/pdf')
  @RequirePermission('export.read')
  @ApiOperation({ summary: 'Server-side Puppeteer PDF of the tree (A0–A4, RTL).' })
  async pdf(@Body() dto: ExportTreePdfDto, @Res() res: Response): Promise<void> {
    this.send(res, await this.service.treePdf(dto));
  }

  @Post('tree/png')
  @RequirePermission('export.read')
  @ApiOperation({ summary: 'High-res PNG of the tree (scale 2/4).' })
  async png(@Body() dto: ExportTreePngDto, @Res() res: Response): Promise<void> {
    this.send(res, await this.service.treePng(dto));
  }

  @Get('persons.xlsx')
  @RequirePermission('export.read')
  @ApiOperation({ summary: 'Persons as xlsx (import-template columns, round-trip).' })
  async personsXlsx(@Res() res: Response): Promise<void> {
    this.send(res, await this.service.persons('xlsx'));
  }

  @Get('persons.csv')
  @RequirePermission('export.read')
  @ApiOperation({ summary: 'Persons as CSV (import-template columns, round-trip).' })
  async personsCsv(@Res() res: Response): Promise<void> {
    this.send(res, await this.service.persons('csv'));
  }

  private send(
    res: Response,
    file: { buffer: Buffer; contentType: string; filename: string },
  ): void {
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    res.send(file.buffer);
  }
}

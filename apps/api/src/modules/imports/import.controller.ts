import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ImportService } from './import.service';
import { ImportTemplateService } from './import-template.service';
import {
  ListImportsDto,
  ListRowsDto,
  SubmitImportDto,
  TemplateQueryDto,
  UpdateImportRowDto,
} from './dto/import.dto';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportController {
  constructor(
    private readonly service: ImportService,
    private readonly templates: ImportTemplateService,
  ) {}

  @Get('template')
  @RequirePermission('import.read')
  @ApiOperation({ summary: 'Download the official bilingual import template (xlsx/csv).' })
  async template(@Query() query: TemplateQueryDto, @Res() res: Response): Promise<void> {
    const file = await this.templates.build(query.format, query.lang);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    res.send(file.buffer);
  }

  @Post()
  @RequirePermission('import.create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload xlsx/csv (field "file"), stream to MinIO, enqueue parse.' })
  upload(@Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.service.upload(req, user);
  }

  @Get()
  @RequirePermission('import.read')
  list(@Query() dto: ListImportsDto) {
    return this.service.list(dto);
  }

  @Get(':id')
  @RequirePermission('import.read')
  @ApiOperation({ summary: 'Batch detail: status, progress, counts.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/rows')
  @RequirePermission('import.read')
  @ApiOperation({ summary: 'Staging rows for preview (filter ?status=).' })
  rows(@Param('id', ParseUUIDPipe) id: string, @Query() dto: ListRowsDto) {
    return this.service.listRows(id, dto);
  }

  @Patch(':id/rows/:rowId')
  @RequirePermission('import.create')
  @ApiOperation({ summary: 'Set row decision (new/merge/ignore), merge target, resolve refs.' })
  updateRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() dto: UpdateImportRowDto,
  ) {
    return this.service.updateRow(id, rowId, dto);
  }

  @Post(':id/submit')
  @RequirePermission('import.create')
  @ApiOperation({ summary: 'Submit the batch as ONE change request into the M2 workflow.' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submit(id, dto, user);
  }

  @Post(':id/rollback')
  @RequirePermission('import.rollback')
  @ApiOperation({ summary: 'Batch-level rollback (refused if later records depend on it).' })
  rollback(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.rollback(id, user);
  }
}

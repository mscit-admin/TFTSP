import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { DocumentService } from './document.service';
import { ConfirmUploadDto, RequestUploadDto } from './dto/document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Post('documents/presign')
  @RequirePermission('document.write')
  @ApiOperation({ summary: 'Get a presigned PUT URL (15-min) for a person document.' })
  presign(@Body() dto: RequestUploadDto) {
    return this.service.presign(dto);
  }

  @Post('documents/confirm')
  @RequirePermission('document.write')
  @ApiOperation({
    summary: 'Register the uploaded document (magic-byte check, SVG rejected, ≤10MB).',
  })
  confirm(@Body() dto: ConfirmUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.confirm(dto, user);
  }

  @Get('persons/:id/documents')
  @RequirePermission('document.read')
  @ApiOperation({ summary: "A person's documents with presigned GET URLs (15-min)." })
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listForPerson(id);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('document.write')
  @ApiOperation({ summary: 'Soft-delete a document.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

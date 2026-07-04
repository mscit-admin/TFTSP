import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { CreateUnionDto, EndUnionDto, RemarryDto } from './dto/union.dto';
import { UnionsService } from './unions.service';

@ApiTags('unions')
@ApiBearerAuth()
@Controller('unions')
export class UnionsController {
  constructor(private readonly service: UnionsService) {}

  @Get()
  @RequirePermission('union.read')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermission('union.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('union.write')
  @ApiOperation({ summary: 'Create a marriage (husband male, wife female).' })
  create(@Body() dto: CreateUnionDto) {
    return this.service.create(dto);
  }

  @Post(':id/divorce')
  @RequirePermission('union.write')
  divorce(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndUnionDto) {
    return this.service.divorce(id, dto);
  }

  @Post(':id/widow')
  @RequirePermission('union.write')
  widow(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndUnionDto) {
    return this.service.widow(id, dto);
  }

  @Post(':id/remarry')
  @RequirePermission('union.write')
  @ApiOperation({ summary: 'Start a new active union between the same partners.' })
  remarry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RemarryDto) {
    return this.service.remarry(id, dto);
  }
}

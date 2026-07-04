import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ScopeCheck } from '../../common/rbac/permissions';
import { CreateTribalUnitDto, UpdateTribalUnitDto } from './dto/tribal-unit.dto';
import { TribalUnitsService } from './tribal-units.service';

@ApiTags('tribal-units')
@ApiBearerAuth()
@Controller('tribal-units')
export class TribalUnitsController {
  constructor(private readonly service: TribalUnitsService) {}

  @Get()
  @RequirePermission('tribalUnit.read')
  @ApiOperation({ summary: 'List tribal units (tribe/branch/clan/family).' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermission('tribalUnit.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('tribalUnit.write', ScopeCheck.TribalUnit)
  create(@Body() dto: CreateTribalUnitDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('tribalUnit.write', ScopeCheck.TribalUnit)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTribalUnitDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('tribalUnit.write', ScopeCheck.TribalUnit)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

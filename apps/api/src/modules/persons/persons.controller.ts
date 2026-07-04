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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { ScopeCheck } from '../../common/rbac/permissions';
import { CreatePersonDto } from './dto/create-person.dto';
import { ListPersonsDto } from './dto/list-persons.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonsService } from './persons.service';

@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @Get()
  @RequirePermission('person.read')
  @ApiOperation({ summary: 'Paginated list with fuzzy name search (?q=).' })
  list(@Query() dto: ListPersonsDto) {
    return this.service.list(dto);
  }

  @Get(':id')
  @RequirePermission('person.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/ancestors')
  @RequirePermission('person.read')
  @ApiOperation({ summary: 'Paternal ancestors via the closure table.' })
  ancestors(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAncestors(id);
  }

  @Get(':id/descendants')
  @RequirePermission('person.read')
  @ApiOperation({ summary: 'Paternal descendants via the closure table.' })
  descendants(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDescendants(id);
  }

  @Post()
  @RequirePermission('person.create', ScopeCheck.TribalUnit)
  @ApiOperation({ summary: 'Create a person; runs the duplicate pre-check (Spec §8).' })
  create(@Body() dto: CreatePersonDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('person.update', ScopeCheck.TribalUnit)
  @ApiOperation({ summary: 'Update with optimistic locking (version).' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('person.delete', ScopeCheck.TribalUnit)
  @ApiOperation({ summary: 'Soft-delete; updates the closure table atomically.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

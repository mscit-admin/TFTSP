import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { TreeQueryDto } from './dto/tree-query.dto';
import { LineageService } from './lineage.service';

@ApiTags('tree')
@ApiBearerAuth()
@Controller('tree')
export class LineageController {
  constructor(private readonly lineage: LineageService) {}

  @Get()
  @RequirePermission('tree.read')
  @ApiOperation({ summary: 'Compact {nodes, edges} tree from a root, lazily by generations.' })
  getTree(@Query() query: TreeQueryDto) {
    return this.lineage.getTree(query.rootId, query.generations);
  }
}

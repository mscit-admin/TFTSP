import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';

const PAPERS = ['A0', 'A1', 'A2', 'A3', 'A4'] as const;
const LAYOUTS = ['vertical', 'horizontal', 'fan'] as const;

export class ExportTreePdfDto {
  @ApiProperty()
  @IsUUID()
  rootId!: string;

  @ApiPropertyOptional({ enum: LAYOUTS, default: 'vertical' })
  @IsOptional()
  @IsIn(LAYOUTS as unknown as string[])
  layout: (typeof LAYOUTS)[number] = 'vertical';

  @ApiPropertyOptional({ enum: PAPERS, default: 'A4' })
  @IsOptional()
  @IsIn(PAPERS as unknown as string[])
  paper: (typeof PAPERS)[number] = 'A4';

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  generations = 3;
}

export class ExportTreePngDto {
  @ApiProperty()
  @IsUUID()
  rootId!: string;

  @ApiPropertyOptional({ enum: LAYOUTS, default: 'vertical' })
  @IsOptional()
  @IsIn(LAYOUTS as unknown as string[])
  layout: (typeof LAYOUTS)[number] = 'vertical';

  @ApiPropertyOptional({ enum: [2, 4], default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([2, 4])
  scale: 2 | 4 = 2;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  generations = 3;
}

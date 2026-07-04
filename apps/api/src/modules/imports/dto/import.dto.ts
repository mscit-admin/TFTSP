import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ImportRowDecision, ImportRowStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class TemplateQueryDto {
  @ApiPropertyOptional({ enum: ['xlsx', 'csv'], default: 'xlsx' })
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format: 'xlsx' | 'csv' = 'xlsx';

  @ApiPropertyOptional({ enum: ['ar', 'en'], default: 'ar' })
  @IsOptional()
  @IsString()
  lang: 'ar' | 'en' = 'ar';
}

export class ListImportsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ListRowsDto {
  @ApiPropertyOptional({ enum: ImportRowStatus })
  @IsOptional()
  @IsEnum(ImportRowStatus)
  status?: ImportRowStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;
}

export class UpdateImportRowDto {
  @ApiPropertyOptional({ enum: ImportRowDecision })
  @IsOptional()
  @IsEnum(ImportRowDecision)
  decision?: ImportRowDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mergeTargetId?: string;

  @ApiPropertyOptional({ description: 'Resolve an ambiguous father reference.' })
  @IsOptional()
  @IsUUID()
  resolvedFatherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedMotherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedSpouseId?: string;
}

export class SubmitImportDto {
  @ApiPropertyOptional({ description: 'Import only valid rows, skipping error rows.' })
  @IsOptional()
  @IsBoolean()
  partial?: boolean;
}

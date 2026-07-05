import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ChangeOperation,
  ChangeTargetType,
  ContributionType,
  ReviewDecision,
} from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/** RFC-6902 op (validated structurally in the service via assertValidPatch). */
export class JsonPatchOpDto {
  @ApiProperty({ enum: ['add', 'remove', 'replace'] })
  @IsString()
  op!: 'add' | 'remove' | 'replace';

  @ApiProperty({ example: '/firstName' })
  @IsString()
  path!: string;

  @ApiPropertyOptional()
  @IsOptional()
  value?: unknown;
}

export class CreateChangeRequestDto {
  @ApiProperty({ enum: ChangeTargetType })
  @IsEnum(ChangeTargetType)
  targetType!: ChangeTargetType;

  @ApiPropertyOptional({ description: 'Required for update/delete; omit for create.' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiProperty({ enum: ChangeOperation })
  @IsEnum(ChangeOperation)
  operation!: ChangeOperation;

  @ApiProperty({ type: [JsonPatchOpDto] })
  @IsArray()
  @Type(() => JsonPatchOpDto)
  patch!: JsonPatchOpDto[];

  @ApiPropertyOptional({
    enum: ContributionType,
    description: 'M4 crowdsourcing: classifies a community contribution (Spec §13).',
  })
  @IsOptional()
  @IsEnum(ContributionType)
  contributionType?: ContributionType;
}

export class UpdateChangeRequestDto {
  @ApiProperty({ type: [JsonPatchOpDto] })
  @IsArray()
  @Type(() => JsonPatchOpDto)
  patch!: JsonPatchOpDto[];
}

export class ReviewChangeRequestDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ListChangeRequestsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Only my requests.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ description: 'Only requests awaiting my review.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  queue?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  pageSize = 20;
}

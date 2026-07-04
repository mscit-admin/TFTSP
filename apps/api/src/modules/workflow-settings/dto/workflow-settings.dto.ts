import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Response shape — Spec §3 M2 workflow settings. */
export class WorkflowSettingsResponseDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ minimum: 1, maximum: 3 })
  approvalsRequired!: number;

  @ApiProperty()
  expiryDays!: number;

  @ApiProperty()
  reviewerCanEdit!: boolean;
}

export class UpdateWorkflowSettingsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  approvalsRequired?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiryDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reviewerCanEdit?: boolean;
}

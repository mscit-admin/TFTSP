import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class SetSubscriptionDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  tier!: PlanTier;

  @ApiPropertyOptional({ description: 'Manual activation expiry (ISO).' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Free-text activation note (e.g. bank-transfer ref).' })
  @IsOptional()
  @IsString()
  note?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberScope, VisibilityLevel, WomenDisplayMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class VisibilitySettingsResponseDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty({ enum: VisibilityLevel }) level!: VisibilityLevel;
  @ApiProperty({ enum: WomenDisplayMode }) womenDisplay!: WomenDisplayMode;
  @ApiProperty() showPhotos!: boolean;
  @ApiProperty() showPhones!: boolean;
  @ApiProperty() showBirthDates!: boolean;
  @ApiProperty() showDeceased!: boolean;
  @ApiProperty() showMinors!: boolean;
  @ApiProperty() showDocuments!: boolean;
  @ApiProperty({ enum: MemberScope }) defaultMemberScope!: MemberScope;
  @ApiProperty() requireIdForViewRequest!: boolean;
}

export class UpdateVisibilitySettingsDto {
  @ApiPropertyOptional({ enum: VisibilityLevel })
  @IsOptional()
  @IsEnum(VisibilityLevel)
  level?: VisibilityLevel;

  @ApiPropertyOptional({ enum: WomenDisplayMode })
  @IsOptional()
  @IsEnum(WomenDisplayMode)
  womenDisplay?: WomenDisplayMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPhotos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPhones?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showBirthDates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showDeceased?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showMinors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showDocuments?: boolean;

  @ApiPropertyOptional({ enum: MemberScope })
  @IsOptional()
  @IsEnum(MemberScope)
  defaultMemberScope?: MemberScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireIdForViewRequest?: boolean;
}

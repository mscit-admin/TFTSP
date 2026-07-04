import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, MinLength } from 'class-validator';

/** Response shape for tribe settings (Spec M1 admin-web: logo + colours + names). */
export class TenantSettingsResponseDto {
  @ApiProperty()
  nameAr!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  logoKey!: string | null;

  @ApiProperty({ nullable: true })
  primaryColor!: string | null;
}

/** A Tribe Admin updates their OWN tenant. slug is immutable here (owned by platform). */
export class UpdateTenantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @ApiPropertyOptional({ example: '#0b7d3e', description: 'Hex colour like #RRGGBB.' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'MinIO object key returned by logo-upload.' })
  @IsOptional()
  @IsString()
  logoKey?: string;
}

export class LogoUploadResponseDto {
  @ApiProperty({ description: 'Presigned PUT URL (15-min TTL).' })
  uploadUrl!: string;

  @ApiProperty({ description: 'Object key to persist via PATCH /tenant/settings.' })
  logoKey!: string;
}

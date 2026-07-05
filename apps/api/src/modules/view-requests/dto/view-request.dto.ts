import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViewRequestStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/** Public submission — tenant identified by slug, no auth (Spec §3·M3.5). */
export class CreateViewRequestDto {
  @ApiProperty({ description: 'Tenant slug (identifies the tribe; no auth needed).' })
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @ApiProperty({ description: 'Triple name.' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allegedBranch?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ description: 'MinIO key of the ID attachment, if the tribe requires it.' })
  @IsOptional()
  @IsString()
  idAttachmentKey?: string;
}

export class ApproveViewRequestDto {
  @ApiProperty({ description: 'Mandatory expiry of the temporary Viewer grant (ISO date).' })
  @IsDateString()
  validTo!: string;
}

export class ListViewRequestsDto {
  @ApiPropertyOptional({ enum: ViewRequestStatus })
  @IsOptional()
  @IsEnum(ViewRequestStatus)
  status?: ViewRequestStatus;
}

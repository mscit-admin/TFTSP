import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB (Spec §M4.3)

export class RequestUploadDto {
  @ApiProperty()
  @IsUUID()
  personId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  filename!: string;

  @ApiProperty({ description: 'Must resolve to image/* or application/pdf; never image/svg+xml.' })
  @IsString()
  @MinLength(1)
  contentType!: string;

  @ApiProperty({ maximum: MAX_DOCUMENT_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_BYTES)
  sizeBytes!: number;
}

export class ConfirmUploadDto {
  @ApiProperty()
  @IsUUID()
  personId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  objectKey!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  filename!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePersonDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grandfatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  familyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  laqab?: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ description: 'YYYY or full ISO date.' })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthPlace?: string;

  @ApiPropertyOptional({ description: 'YYYY or full ISO date.' })
  @IsOptional()
  @IsString()
  deathDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDeceased?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fatherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tribalUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({
    description: 'Required to proceed when duplicate candidates (similarity >= 0.6) were returned.',
  })
  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}

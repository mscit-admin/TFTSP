import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UnitType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTribalUnitDto {
  @ApiPropertyOptional({ description: 'Parent unit (self-referential hierarchy).' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ enum: UnitType })
  @IsEnum(UnitType)
  unitType!: UnitType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  nameEn!: string;
}

export class UpdateTribalUnitDto extends PartialType(CreateTribalUnitDto) {}

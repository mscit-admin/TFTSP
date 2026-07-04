import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength, ValidateNested } from 'class-validator';

export class CreateTenantAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  password!: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'bani-hilal', description: 'URL-safe unique slug.' })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, { message: 'slug must be url-safe' })
  slug!: string;

  @ApiProperty({ example: 'بنو هلال' })
  @IsString()
  @MinLength(1)
  nameAr!: string;

  @ApiProperty({ example: 'Bani Hilal' })
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @ApiProperty({ type: CreateTenantAdminDto })
  @ValidateNested()
  @Type(() => CreateTenantAdminDto)
  admin!: CreateTenantAdminDto;
}

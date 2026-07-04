import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@tribe.example' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: 'Select active tenant at login for multi-tribe users.' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

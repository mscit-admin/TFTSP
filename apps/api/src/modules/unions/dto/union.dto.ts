import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUnionDto {
  @ApiProperty()
  @IsUUID()
  husbandId!: string;

  @ApiProperty()
  @IsUUID()
  wifeId!: string;

  @ApiPropertyOptional({ description: 'YYYY or full ISO date.' })
  @IsOptional()
  @IsString()
  marriageDate?: string;
}

export class EndUnionDto {
  @ApiProperty({ description: 'YYYY or full ISO date the union ended.' })
  @IsString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endReason?: string;
}

export class RemarryDto {
  @ApiPropertyOptional({ description: 'YYYY or full ISO date of the new marriage.' })
  @IsOptional()
  @IsString()
  marriageDate?: string;
}

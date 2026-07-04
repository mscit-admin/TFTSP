import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class TreeQueryDto {
  @ApiProperty({ description: 'Root person id to expand from.' })
  @IsUUID()
  rootId!: string;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  generations = 3;
}

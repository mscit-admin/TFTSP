import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePersonDto } from './create-person.dto';

export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @ApiProperty({ description: 'Current version for optimistic locking (Spec §5).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

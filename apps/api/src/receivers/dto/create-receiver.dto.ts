import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReceiverDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  x!: number;

  @Type(() => Number)
  @IsNumber()
  y!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;
}

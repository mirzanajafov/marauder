import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReceiverDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  x?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  y?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;
}
